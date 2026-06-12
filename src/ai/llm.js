const axios = require('axios');

// Adaptador de LLM con dos proveedores y la misma interfaz:
// - Ollama (desarrollo): corre en tu máquina, gratis, sin API key.
// - Groq (producción): API en la nube con free tier generoso y sin tarjeta.
//   En Vercel no hay Ollama, así que si existe GROQ_API_KEY se usa Groq.
//
// Ambos sirven modelos Llama, así el mismo prompt funciona igual en los dos.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function config() {
  if (process.env.GROQ_API_KEY) {
    return { proveedor: 'groq', modelo: process.env.GROQ_MODEL || 'llama-3.1-8b-instant' };
  }
  return {
    proveedor: 'ollama',
    modelo: process.env.OLLAMA_MODEL || 'llama3',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  };
}

// ── Generación sin streaming (scripts, scorer, letterWriter) ─────────────────

async function generar(prompt) {
  const cfg = config();

  if (cfg.proveedor === 'groq') {
    const res = await axios.post(GROQ_URL, {
      model: cfg.modelo,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }, {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 120000,
    });
    return res.data.choices[0].message.content;
  }

  const res = await axios.post(`${cfg.baseUrl}/api/generate`, {
    model: cfg.modelo,
    prompt,
    stream: false,
  }, { timeout: 300000 });
  return res.data.response;
}

// ── Generación con streaming (dashboard: tokens en tiempo real) ──────────────
// onToken se llama por cada trozo de texto; devuelve el texto completo.
// señal (AbortSignal) permite cancelar si el cliente cierra la conexión.

async function generarStream(prompt, onToken, señal) {
  const cfg = config();
  let completo = '';

  if (cfg.proveedor === 'groq') {
    const res = await axios.post(GROQ_URL, {
      model: cfg.modelo,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }, {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      responseType: 'stream',
      timeout: 300000,
      signal: señal,
    });

    // Groq emite SSE estilo OpenAI: líneas "data: {...}" y final "data: [DONE]"
    await new Promise((resolve, reject) => {
      let buffer = '';
      res.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lineas = buffer.split('\n');
        buffer = lineas.pop();
        for (const linea of lineas) {
          if (!linea.startsWith('data: ')) continue;
          const datos = linea.slice(6).trim();
          if (datos === '[DONE]') return resolve();
          try {
            const token = JSON.parse(datos).choices?.[0]?.delta?.content;
            if (token) {
              completo += token;
              onToken(token);
            }
          } catch { /* línea incompleta */ }
        }
      });
      res.data.on('end', resolve);
      res.data.on('error', reject);
    });

    return completo;
  }

  // Ollama emite un objeto JSON por línea: { response, done }
  const res = await axios.post(`${cfg.baseUrl}/api/generate`, {
    model: cfg.modelo,
    prompt,
    stream: true,
  }, { responseType: 'stream', timeout: 300000, signal: señal });

  await new Promise((resolve, reject) => {
    let buffer = '';
    res.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lineas = buffer.split('\n');
      buffer = lineas.pop();
      for (const linea of lineas) {
        if (!linea.trim()) continue;
        try {
          const json = JSON.parse(linea);
          if (json.response) {
            completo += json.response;
            onToken(json.response);
          }
          if (json.done) return resolve();
        } catch { /* línea incompleta */ }
      }
    });
    res.data.on('end', resolve);
    res.data.on('error', reject);
  });

  return completo;
}

// ── Estado del proveedor (para el indicador del dashboard) ───────────────────

async function estado() {
  const cfg = config();

  if (cfg.proveedor === 'groq') {
    try {
      await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 4000,
      });
      return { ok: true, proveedor: 'groq', modelo: cfg.modelo };
    } catch {
      return { ok: false, proveedor: 'groq', modelo: cfg.modelo };
    }
  }

  try {
    await axios.get(cfg.baseUrl, { timeout: 2000 });
    return { ok: true, proveedor: 'ollama', modelo: cfg.modelo };
  } catch {
    return { ok: false, proveedor: 'ollama', modelo: cfg.modelo };
  }
}

module.exports = { generar, generarStream, estado };
