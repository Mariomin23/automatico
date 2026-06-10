require('dotenv').config();

const { cargarVistas, guardarVistas } = require('./utils/storage');
const { obtenerOfertas } = require('./scraper/index');
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

  const { ofertas, urlsEncontradas } = await obtenerOfertas(vistas);

  if (ofertas.length === 0) {
    log('El scraping no devolvió ofertas. No se genera resumen.');
    return;
  }

  const rutaResumen = generarResumen(ofertas);
  log(`Resumen guardado en: ${rutaResumen}`);

  await enviarResumen(rutaResumen);

  // Marca como vistas todas las encontradas, también las que no entraron en el resumen
  const vistasActualizadas = [...new Set([...vistas, ...urlsEncontradas])];
  guardarVistas(vistasActualizadas);
  log(`seen_jobs.json actualizado: ${vistasActualizadas.length} registros`);

  log(`✅ Completado. ${ofertas.length} ofertas guardadas.`);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
