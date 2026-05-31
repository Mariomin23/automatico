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

  // Combina y deduplica por URL
  const todas = [...ofertasTecno, ...ofertasGoogle];
  const mapa = new Map();
  for (const o of todas) {
    if (!mapa.has(o.url)) mapa.set(o.url, o);
  }

  // Filtra por palabras excluidas en título
  const excluir = profile.busqueda.excluir || [];
  const filtradas = Array.from(mapa.values()).filter((o) => {
    const titulo = o.titulo.toLowerCase();
    return !excluir.some((ex) => titulo.includes(ex.toLowerCase()));
  });

  const descartadas = mapa.size - filtradas.length;
  if (descartadas > 0) log(`Filtradas por excluir (${excluir.join(', ')}): ${descartadas} ofertas`);

  const resultado = filtradas.slice(0, maxOfertas);
  log(`Total ofertas nuevas: ${resultado.length}`);
  return resultado;
}

module.exports = { obtenerOfertasNuevas };
