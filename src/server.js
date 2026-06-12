require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, '../output');

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Solo acepta fechas YYYY-MM-DD y slugs alfanuméricos — evita rutas fuera de output/
const FECHA_OK = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const SLUG_OK = (s) => /^[\w-]+$/.test(s);

// Lista de runs guardados con su total de ofertas: [{ date, total }]
app.get('/api/runs', (req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) return res.json([]);

  const runs = fs.readdirSync(OUTPUT_DIR)
    .filter(FECHA_OK)
    .sort()
    .reverse()
    .map((date) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, date, 'resumen.json'), 'utf-8'));
        return { date, total: data.total };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  res.json(runs);
});

// Datos de un run concreto + slugs que ya tienen carta guardada
app.get('/api/runs/:date', (req, res) => {
  if (!FECHA_OK(req.params.date)) return res.status(400).json({ error: 'Fecha inválida' });

  const carpeta = path.join(OUTPUT_DIR, req.params.date);
  const jsonPath = path.join(carpeta, 'resumen.json');
  if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'No encontrado' });

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const cartas = fs.readdirSync(carpeta)
      .filter((f) => f.endsWith('_carta.md'))
      .map((f) => f.slice(0, -'_carta.md'.length));
    res.json({ ...data, cartas });
  } catch {
    res.status(500).json({ error: 'Error leyendo datos' });
  }
});

// Carta de presentación guardada de una oferta
app.get('/api/runs/:date/carta/:slug', (req, res) => {
  if (!FECHA_OK(req.params.date) || !SLUG_OK(req.params.slug)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  const cartaPath = path.join(OUTPUT_DIR, req.params.date, `${req.params.slug}_carta.md`);
  if (!fs.existsSync(cartaPath)) return res.status(404).json({ error: 'Carta no encontrada' });

  const contenido = fs.readFileSync(cartaPath, 'utf-8');
  // Extrae solo el cuerpo (después del ---)
  const partes = contenido.split('---\n\n');
  const carta = partes.length > 1 ? partes.slice(1).join('---\n\n').trim() : contenido;
  res.json({ carta });
});

// Genera carta con streaming SSE — el cliente ve tokens en tiempo real
app.post('/api/carta/generar', async (req, res) => {
  const { titulo, empresa, descripcion, url, date, slug } = req.body;
  if (!titulo || !empresa) return res.status(400).json({ error: 'Faltan datos de la oferta' });

  const axios = require('axios');
  const { promptCarta } = require('./ai/prompts');
  const ollamaUrl = `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`;
  const modelo = process.env.OLLAMA_MODEL || 'llama3';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  let stream;
  try {
    stream = await axios.post(ollamaUrl, {
      model: modelo,
      prompt: promptCarta({ titulo, empresa, descripcion: descripcion || '', url: url || '' }),
      stream: true,
    }, { responseType: 'stream', timeout: 300000 });
  } catch (err) {
    send({ error: 'Ollama no responde. ¿Está activo?' });
    return res.end();
  }

  let cartaCompleta = '';
  let buffer = '';

  stream.data.on('data', (chunk) => {
    buffer += chunk.toString();
    const lineas = buffer.split('\n');
    buffer = lineas.pop(); // guarda línea incompleta

    for (const linea of lineas) {
      if (!linea.trim()) continue;
      try {
        const json = JSON.parse(linea);
        if (json.response) {
          cartaCompleta += json.response;
          send({ token: json.response });
        }
        if (json.done) {
          // Guarda la carta en disco
          if (date && slug && FECHA_OK(date) && SLUG_OK(slug)) {
            const carpeta = path.join(OUTPUT_DIR, date);
            if (fs.existsSync(carpeta)) {
              fs.writeFileSync(
                path.join(carpeta, `${slug}_carta.md`),
                `# Carta para ${empresa}\n\n_${titulo}_\n\n---\n\n${cartaCompleta}\n`,
                'utf-8'
              );
            }
          }
          send({ done: true });
          res.end();
        }
      } catch { /* línea JSON incompleta, ignorar */ }
    }
  });

  stream.data.on('error', () => {
    send({ error: 'Error de conexión con Ollama' });
    res.end();
  });

  req.on('close', () => stream.data.destroy());
});

// ── CRM de candidaturas ──────────────────────────────────────────────────────
// Estados por slug en data/applications_status.json: { "slug": "aplicado" | "descartado" }
// "pendiente" es el estado por defecto y no se persiste.

const DATA_DIR = path.join(__dirname, '../data');
const ESTADOS_PATH = path.join(DATA_DIR, 'applications_status.json');
const ESTADOS_VALIDOS = ['pendiente', 'aplicado', 'descartado'];

function leerEstados() {
  try {
    return JSON.parse(fs.readFileSync(ESTADOS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

// Mapa completo de estados guardados
app.get('/api/estados', (req, res) => {
  res.json(leerEstados());
});

// Cambia el estado de una oferta
app.post('/api/estados/:slug', (req, res) => {
  if (!SLUG_OK(req.params.slug)) return res.status(400).json({ error: 'Slug inválido' });

  const { estado } = req.body || {};
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Usa: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  const estados = leerEstados();
  if (estado === 'pendiente') {
    delete estados[req.params.slug];
  } else {
    estados[req.params.slug] = estado;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ESTADOS_PATH, JSON.stringify(estados, null, 2), 'utf-8');
    res.json({ ok: true, slug: req.params.slug, estado });
  } catch {
    res.status(500).json({ error: 'Error guardando estado' });
  }
});

// Estado de Ollama
app.get('/api/status', async (req, res) => {
  const axios = require('axios');
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const modelo = process.env.OLLAMA_MODEL || 'llama3';
  try {
    await axios.get(ollamaUrl, { timeout: 2000 });
    res.json({ ollama: true, modelo });
  } catch {
    res.json({ ollama: false, modelo });
  }
});

// Lanza una nueva búsqueda con SSE para logs en tiempo real
app.get('/api/run/start', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'log', msg: 'Iniciando búsqueda...' });

  const proc = spawn('node', ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
  });

  proc.stdout.on('data', (data) => {
    data.toString().trim().split('\n').forEach((line) => {
      if (line) send({ type: 'log', msg: line });
    });
  });

  proc.stderr.on('data', (data) => {
    data.toString().trim().split('\n').forEach((line) => {
      if (line) send({ type: 'error', msg: line });
    });
  });

  proc.on('close', (code) => {
    send({ type: 'done', code });
    res.end();
  });

  req.on('close', () => proc.kill());
});

app.listen(PORT, () => {
  console.log(`Dashboard en http://localhost:${PORT}`);
});
