const { cargarVistas, guardarVistas } = require('./utils/storage');
const { obtenerOfertas } = require('./scraper/index');
const { generarResumen } = require('./utils/output');
const { enviarResumen } = require('./utils/mailer');

// Orquestación de una búsqueda completa, reutilizable desde:
// - la CLI (src/index.js)
// - el dashboard (/api/run/start), que pasa su propio log para reenviar por SSE
async function runBusqueda(logRaw = console.log) {
  const log = (msg) => {
    const hora = new Date().toTimeString().slice(0, 5);
    logRaw(`[${hora}] ${msg}`);
  };

  log('Iniciando job-hunter-ai...');

  const vistas = await cargarVistas();
  log(`Cargando ofertas ya vistas: ${vistas.length} registros`);

  const { ofertas, urlsEncontradas } = await obtenerOfertas(vistas, log);

  if (ofertas.length === 0) {
    log('El scraping no devolvió ofertas. No se genera resumen.');
    return { total: 0, nuevas: 0 };
  }

  const resumen = await generarResumen(ofertas);
  log(`Resumen guardado en: ${resumen.ruta}`);

  await enviarResumen(resumen.md, resumen.fecha);

  // Marca como vistas todas las encontradas, también las que no entraron en el resumen
  const vistasActualizadas = [...new Set([...vistas, ...urlsEncontradas])];
  await guardarVistas(vistasActualizadas);
  log(`seen_jobs.json actualizado: ${vistasActualizadas.length} registros`);

  const nuevas = ofertas.filter((o) => o.nueva).length;
  log(`✅ Completado. ${ofertas.length} ofertas guardadas.`);

  return { total: ofertas.length, nuevas };
}

module.exports = { runBusqueda };
