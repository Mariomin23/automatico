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
