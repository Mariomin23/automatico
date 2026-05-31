const tecnoempleo = require('./tecnoempleo');
const googlejobs = require('./googlejobs');
const { esNueva } = require('../utils/storage');
const profile = require('../config/profile');

function log(msg) {
  const hora = new Date().toTimeString().slice(0, 5);
  console.log(`[${hora}] ${msg}`);
}

async function obtenerOfertasNuevas(vistas) {
  const keywords = profile.busqueda.keywords;
  const maxOfertas = parseInt(process.env.MAX_OFFERS_PER_RUN || '20', 10);

  // Tecnoempleo
  log('Scraping Tecnoempleo...');
  let ofertasTecno = [];
  try {
    ofertasTecno = await tecnoempleo.obtenerOfertas(keywords);
    const nuevasTecno = ofertasTecno.filter((o) => esNueva(o.url, vistas));
    log(`Tecnoempleo: ${ofertasTecno.length} ofertas encontradas, ${nuevasTecno.length} nuevas`);
    ofertasTecno = nuevasTecno;
  } catch (err) {
    console.error(`[Scraper] Tecnoempleo falló: ${err.message}`);
  }

  // Google Jobs
  log('Scraping Google Jobs...');
  let ofertasGoogle = [];
  try {
    ofertasGoogle = await googlejobs.obtenerOfertas(keywords);
    const nuevasGoogle = ofertasGoogle.filter((o) => esNueva(o.url, vistas));
    log(`Google Jobs: ${ofertasGoogle.length} ofertas encontradas, ${nuevasGoogle.length} nuevas`);
    ofertasGoogle = nuevasGoogle;
  } catch (err) {
    console.error(`[Scraper] Google Jobs falló: ${err.message}`);
  }

  // Combina, deduplica por URL y limita al máximo configurado
  const todas = [...ofertasTecno, ...ofertasGoogle];
  const mapa = new Map();
  for (const o of todas) {
    if (!mapa.has(o.url)) mapa.set(o.url, o);
  }

  const resultado = Array.from(mapa.values()).slice(0, maxOfertas);
  log(`Total ofertas nuevas: ${resultado.length}`);
  return resultado;
}

module.exports = { obtenerOfertasNuevas };
