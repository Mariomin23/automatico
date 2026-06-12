require('dotenv').config();

const express = require('express');
const path = require('path');
const store = require('./utils/store');
const llm = require('./ai/llm');
const { runBusqueda } = require('./run');
const { promptCarta } = require('./ai/prompts');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Token de administración: protege los endpoints que escriben datos o cuestan
// dinero (lanzar búsquedas, generar cartas, cambiar estados del CRM).
// Si ADMIN_TOKEN no está configurado (desarrollo local), no se exige nada.
// El SSE de búsqueda usa ?token= porque EventSource no permite headers.
function requiereAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next();
  const enviado = req.get('x-admin-token') || req.query.token;
  if (enviado === token) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// Comprobación de token para el frontend (no hace nada más)
app.get('/api/admin/check', requiereAdmin, (req, res) => res.json({ ok: true }));

// Solo acepta fechas YYYY-MM-DD y slugs alfanuméricos — evita claves arbitrarias
const FECHA_OK = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const SLUG_OK = (s) => /^[\w-]+$/.test(s);

// Lista de runs guardados con su total de ofertas: [{ date, total }]
app.get('/api/runs', async (req, res) => {
  try {
    const claves = await store.listar('output/');
    const fechas = [...new Set(
      claves
        .filter((c) => c.endsWith('/resumen.json'))
        .map((c) => c.split('/')[1])
        .filter(FECHA_OK)
    )].sort().reverse();

    const runs = await Promise.all(fechas.map(async (date) => {
      const data = await store.leerJSON(`output/${date}/resumen.json`);
      return data ? { date, total: data.total } : null;
    }));

    res.json(runs.filter(Boolean));
  } catch (err) {
    console.error(`[Server] /api/runs: ${err.message}`);
    res.status(500).json({ error: 'Error listando runs' });
  }
});

// Datos de un run concreto + slugs que ya tienen carta guardada
app.get('/api/runs/:date', async (req, res) => {
  if (!FECHA_OK(req.params.date)) return res.status(400).json({ error: 'Fecha inválida' });

  try {
    const data = await store.leerJSON(`output/${req.params.date}/resumen.json`);
    if (!data) return res.status(404).json({ error: 'No encontrado' });

    const claves = await store.listar(`output/${req.params.date}/`);
    const cartas = claves
      .filter((c) => c.endsWith('_carta.md'))
      .map((c) => c.split('/').pop().slice(0, -'_carta.md'.length));

    res.json({ ...data, cartas });
  } catch (err) {
    console.error(`[Server] /api/runs/:date: ${err.message}`);
    res.status(500).json({ error: 'Error leyendo datos' });
  }
});

// Carta de presentación guardada de una oferta
app.get('/api/runs/:date/carta/:slug', async (req, res) => {
  if (!FECHA_OK(req.params.date) || !SLUG_OK(req.params.slug)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  const contenido = await store.leerTexto(`output/${req.params.date}/${req.params.slug}_carta.md`);
  if (contenido == null) return res.status(404).json({ error: 'Carta no encontrada' });

  // Extrae solo el cuerpo (después del ---)
  const partes = contenido.split('---\n\n');
  const carta = partes.length > 1 ? partes.slice(1).join('---\n\n').trim() : contenido;
  res.json({ carta });
});

// En Vercel no hay Ollama; sin GROQ_API_KEY las cartas solo funcionan en local
function cartasDisponibles() {
  return !(process.env.VERCEL && !process.env.GROQ_API_KEY);
}

// Genera carta con streaming SSE — el cliente ve tokens en tiempo real
app.post('/api/carta/generar', requiereAdmin, async (req, res) => {
  if (!cartasDisponibles()) {
    return res.status(503).json({ error: 'Esta función solo está disponible en entorno local' });
  }

  const { titulo, empresa, descripcion, url, date, slug } = req.body;
  if (!titulo || !empresa) return res.status(400).json({ error: 'Faltan datos de la oferta' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Si el cliente cierra (botón Detener), aborta la generación
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const carta = await llm.generarStream(
      promptCarta({ titulo, empresa, descripcion: descripcion || '', url: url || '' }),
      (token) => send({ token }),
      controller.signal
    );

    // Guarda la carta para reutilizarla en visitas posteriores
    if (date && slug && FECHA_OK(date) && SLUG_OK(slug)) {
      await store.escribirTexto(
        `output/${date}/${slug}_carta.md`,
        `# Carta para ${empresa}\n\n_${titulo}_\n\n---\n\n${carta}\n`
      );
    }

    send({ done: true });
  } catch (err) {
    if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
      console.error(`[Server] /api/carta/generar: ${err.message}`);
      send({ error: 'El LLM no responde. Revisa la configuración (Ollama local o GROQ_API_KEY).' });
    }
  }

  res.end();
});

// ── CRM de candidaturas ──────────────────────────────────────────────────────
// Estados por slug en data/applications_status.json: { "slug": "aplicado" | "descartado" }
// "pendiente" es el estado por defecto y no se persiste.

const ESTADOS_KEY = 'data/applications_status.json';
const ESTADOS_VALIDOS = ['pendiente', 'aplicado', 'descartado'];

// Mapa completo de estados guardados
app.get('/api/estados', async (req, res) => {
  res.json((await store.leerJSON(ESTADOS_KEY, {})) || {});
});

// Cambia el estado de una oferta
app.post('/api/estados/:slug', requiereAdmin, async (req, res) => {
  if (!SLUG_OK(req.params.slug)) return res.status(400).json({ error: 'Slug inválido' });

  const { estado } = req.body || {};
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Usa: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  try {
    const estados = (await store.leerJSON(ESTADOS_KEY, {})) || {};
    if (estado === 'pendiente') {
      delete estados[req.params.slug];
    } else {
      estados[req.params.slug] = estado;
    }
    await store.escribirJSON(ESTADOS_KEY, estados);
    res.json({ ok: true, slug: req.params.slug, estado });
  } catch (err) {
    console.error(`[Server] /api/estados: ${err.message}`);
    res.status(500).json({ error: 'Error guardando estado' });
  }
});

// Estado del LLM (Ollama en local, Groq en producción)
app.get('/api/status', async (req, res) => {
  if (!cartasDisponibles()) {
    return res.json({ ollama: false, proveedor: 'ninguno', modelo: '', cartas: false });
  }
  const { ok, proveedor, modelo } = await llm.estado();
  // "ollama" se mantiene por compatibilidad con el frontend: significa "LLM disponible"
  res.json({ ollama: ok, proveedor, modelo, cartas: true });
});

// Lanza una nueva búsqueda con SSE para logs en tiempo real
app.get('/api/run/start', requiereAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    await runBusqueda((msg) => send({ type: 'log', msg }));
    send({ type: 'done', code: 0 });
  } catch (err) {
    send({ type: 'error', msg: err.message });
    send({ type: 'done', code: 1 });
  }

  res.end();
});

// En local arranca el servidor; en Vercel la app se exporta como función serverless
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Dashboard en http://localhost:${PORT}`);
  });
}

module.exports = app;
