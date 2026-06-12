const tecnoempleo = require('./tecnoempleo');
const infojobs = require('./infojobs');
const { esNueva } = require('../utils/storage');
const profile = require('../config/profile');

// Log por defecto si no llega uno desde fuera (run.js pasa el suyo para SSE)
function logConsola(msg) {
  const hora = new Date().toTimeString().slice(0, 5);
  console.log(`[${hora}] ${msg}`);
}

// Palabra completa: "java" no descarta "javascript"
function tituloExcluido(titulo, excluir) {
  return excluir.some((ex) => new RegExp(`\\b${ex}\\b`, 'i').test(titulo));
}

async function scrapearFuente(nombre, scraper, keywords, log) {
  log(`Scraping ${nombre}...`);
  try {
    const ofertas = await scraper.obtenerOfertas(keywords);
    log(`${nombre}: ${ofertas.length} ofertas encontradas`);
    return ofertas;
  } catch (err) {
    console.error(`[Scraper] ${nombre} falló: ${err.message}`);
    return [];
  }
}

// Devuelve { ofertas, urlsEncontradas }:
// - ofertas: las que van al resumen (nuevas primero, ya filtradas y con tope)
// - urlsEncontradas: TODAS las scrapeadas, para marcarlas como vistas
async function obtenerOfertas(vistas, log = logConsola) {
  const keywords = profile.busqueda.keywords;
  const maxOfertas = parseInt(process.env.MAX_OFFERS_PER_RUN || '20', 10);

  const ofertasTecno = await scrapearFuente('Tecnoempleo', tecnoempleo, keywords, log);
  const ofertasInfo = await scrapearFuente('InfoJobs', infojobs, keywords, log);

  // Combina y deduplica por URL
  const mapa = new Map();
  for (const o of [...ofertasTecno, ...ofertasInfo]) {
    if (!mapa.has(o.url)) mapa.set(o.url, o);
  }

  // Filtra por palabras excluidas en título
  const excluir = profile.busqueda.excluir || [];
  const filtradas = Array.from(mapa.values()).filter((o) => !tituloExcluido(o.titulo, excluir));

  const descartadas = mapa.size - filtradas.length;
  if (descartadas > 0) log(`Filtradas por excluir (${excluir.join(', ')}): ${descartadas} ofertas`);

  // Marca las nuevas y las pone primero: el tope nunca deja fuera una nueva
  const conNueva = filtradas.map((o) => ({ ...o, nueva: esNueva(o.url, vistas) }));
  conNueva.sort((a, b) => (b.nueva ? 1 : 0) - (a.nueva ? 1 : 0));

  const ofertas = conNueva.slice(0, maxOfertas);
  const nuevas = ofertas.filter((o) => o.nueva).length;
  log(`Total: ${ofertas.length} ofertas (${nuevas} nuevas)`);

  return { ofertas, urlsEncontradas: Array.from(mapa.keys()) };
}

module.exports = { obtenerOfertas };
