require('dotenv').config();

const { cargarVistas, guardarVistas } = require('./utils/storage');
const { obtenerOfertasNuevas } = require('./scraper/index');
const { generarResumen } = require('./utils/output');
const { enviarResumen } = require('./utils/mailer');

function log(msg) {
  const hora = new Date().toTimeString().slice(0, 5);
  console.log(`[${hora}] ${msg}`);
}

async function main() {
  log('Iniciando job-hunter-ai...');

  const vistas = cargarVistas();
  log(`Cargando ofertas ya vistas: ${vistas.length} registros`);

  const ofertasNuevas = await obtenerOfertasNuevas(vistas);

  if (ofertasNuevas.length === 0) {
    log('No hay ofertas nuevas hoy. Fin.');
    return;
  }

  const rutaResumen = generarResumen(ofertasNuevas);
  log(`Resumen guardado en: ${rutaResumen}`);

  await enviarResumen(rutaResumen);

  const urlsNuevas = ofertasNuevas.map((o) => o.url);
  const vistasActualizadas = [...new Set([...vistas, ...urlsNuevas])];
  guardarVistas(vistasActualizadas);
  log(`seen_jobs.json actualizado: ${vistasActualizadas.length} registros`);

  log(`✅ Completado. ${ofertasNuevas.length} ofertas guardadas.`);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
