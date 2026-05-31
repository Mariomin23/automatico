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

// Lista de fechas con runs guardados
app.get('/api/runs', (req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) return res.json([]);

  const runs = fs.readdirSync(OUTPUT_DIR)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .filter((d) => fs.existsSync(path.join(OUTPUT_DIR, d, 'resumen.json')))
    .sort()
    .reverse();

  res.json(runs);
});

// Datos de un run concreto
app.get('/api/runs/:date', (req, res) => {
  const jsonPath = path.join(OUTPUT_DIR, req.params.date, 'resumen.json');
  if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'No encontrado' });

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Error leyendo datos' });
  }
});

// Carta de presentación de una empresa
app.get('/api/runs/:date/carta/:slug', (req, res) => {
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
          if (date && slug) {
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

// Estado de Ollama
app.get('/api/status', async (req, res) => {
  const axios = require('axios');
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const modelo = process.env.OLLAMA_MODEL || 'llama3.2';
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
