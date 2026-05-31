const axios = require('axios');
const { promptPuntuacion } = require('./prompts');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
  const hora = new Date().toTimeString().slice(0, 5);
  console.log(`[${hora}] ${msg}`);
}

async function puntuarOferta(oferta) {
  let respuestaTexto;
  try {
    const response = await axios.post(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`, {
      model: process.env.OLLAMA_MODEL || 'llama3.2',
      prompt: promptPuntuacion(oferta),
      stream: false,
    });
    respuestaTexto = response.data.response;
  } catch (err) {
    console.error(`[Scorer] Error Ollama para "${oferta.titulo}": ${err.message}`);
    return null;
  }

  let resultado;
  try {
    resultado = JSON.parse(respuestaTexto);
  } catch {
    // Ollama devolvió texto con JSON embebido — extráelo
    const match = respuestaTexto.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error(`[Scorer] No se pudo parsear respuesta para "${oferta.titulo}"`);
      return null;
    }
    try {
      resultado = JSON.parse(match[0]);
    } catch {
      console.error(`[Scorer] JSON inválido para "${oferta.titulo}"`);
      return null;
    }
  }

  return resultado;
}

async function puntuarOfertas(ofertas) {
  const resultados = [];
  const modelo = process.env.OLLAMA_MODEL || 'llama3.2';

  log(`Puntuando ofertas con Ollama (${modelo})...`);

  for (const oferta of ofertas) {
    const puntuacion = await puntuarOferta(oferta);

    if (!puntuacion) {
      await sleep(1000);
      continue;
    }

    const emoji = puntuacion.apto ? '✅' : '❌';
    log(`→ ${oferta.empresa}: ${puntuacion.puntuacion}/10 ${emoji}`);

    resultados.push({
      ...oferta,
      puntuacion: puntuacion.puntuacion,
      apto: puntuacion.apto,
      motivo: puntuacion.motivo,
      keywords_match: puntuacion.keywords_match || [],
      alerta: puntuacion.alerta || null,
    });

    // Rate limiting: mínimo 1 segundo entre llamadas
    await sleep(1100);
  }

  return resultados;
}

module.exports = { puntuarOfertas };
