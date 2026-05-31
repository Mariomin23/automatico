require('dotenv').config();

const { cargarVistas, guardarVistas } = require('./utils/storage');
const { obtenerOfertasNuevas } = require('./scraper/index');
const { puntuarOfertas } = require('./ai/scorer');
const { generarCartas } = require('./ai/letterWriter');
const { generarResumen, guardarCartas } = require('./utils/output');
const { enviarResumen } = require('./utils/mailer');

function log(msg) {
  const hora = new Date().toTimeString().slice(0, 5);
  console.log(`[${hora}] ${msg}`);
}

async function main() {
  log('Iniciando job-hunter-ai...');

  // Verifica que Ollama está activo antes de continuar
  const modelo = process.env.OLLAMA_MODEL || 'llama3.2';
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  try {
    const axios = require('axios');
    await axios.get(ollamaUrl, { timeout: 3000 });
    log(`Verificando Ollama (${modelo})... OK`);
  } catch {
    console.error(`ERROR: Ollama no está activo. Ejecuta 'ollama serve' primero.\nDescarga Ollama en https://ollama.com y el modelo con: ollama pull ${modelo}`);
    process.exit(1);
  }

  // Carga historial de ofertas ya vistas
  const vistas = cargarVistas();
  log(`Cargando ofertas ya vistas: ${vistas.length} registros`);

  // Scraping
  const ofertasNuevas = await obtenerOfertasNuevas(vistas);

  if (ofertasNuevas.length === 0) {
    log('No hay ofertas nuevas hoy. Fin.');
    return;
  }

  // Puntuación con Ollama
  const ofertasPuntuadas = await puntuarOfertas(ofertasNuevas);

  // Generación de cartas solo para las aptas
  const minScore = parseInt(process.env.MIN_SCORE_FOR_LETTER || '7', 10);
  const aptas = ofertasPuntuadas.filter((o) => o.apto && o.puntuacion >= minScore);
  const ofertasConCarta = await generarCartas(aptas);

  // Output en Markdown
  const rutaResumen = generarResumen(ofertasPuntuadas);
  guardarCartas(ofertasConCarta);
  log(`Resumen guardado en: ${rutaResumen}`);

  // Email opcional
  await enviarResumen(rutaResumen);

  // Actualiza seen_jobs.json al final (no durante el proceso)
  const urlsNuevas = ofertasNuevas.map((o) => o.url);
  const vistasActualizadas = [...new Set([...vistas, ...urlsNuevas])];
  guardarVistas(vistasActualizadas);
  log(`seen_jobs.json actualizado: ${vistasActualizadas.length} registros`);

  log(`✅ Completado. ${ofertasConCarta.length} candidaturas listas.`);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
