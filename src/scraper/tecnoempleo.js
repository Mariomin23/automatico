const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.tecnoempleo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapearPagina(keywords) {
  const query = keywords.join('+');
  const url = `${BASE_URL}/busqueda-empleo.php?te=${query}&provincia=28`;

  let html;
  try {
    const respuesta = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    html = respuesta.data;
  } catch (err) {
    console.error(`[Tecnoempleo] Error al scrapear: ${err.message}`);
    return [];
  }

  const $ = cheerio.load(html);
  const ofertas = [];

  // Cada oferta aparece en un bloque con clase .p-2.border o similar — adaptar si cambia el HTML
  $('div.col-10.py-1').each((_, el) => {
    const titulo = $(el).find('a.font-weight-bold').text().trim();
    const href = $(el).find('a.font-weight-bold').attr('href');
    const empresa = $(el).find('span.d-none.d-sm-inline').first().text().trim();
    const descripcion = $(el).find('p').text().trim();

    if (!titulo || !href) return;

    ofertas.push({
      titulo,
      empresa: empresa || 'Desconocida',
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      descripcion,
      fuente: 'Tecnoempleo',
    });
  });

  return ofertas;
}

async function obtenerOfertas(keywords) {
  const ofertas = [];

  // Busca por cada keyword principal con pausa entre peticiones
  const kwPrincipales = keywords.slice(0, 3);
  for (const kw of kwPrincipales) {
    const resultado = await scrapearPagina([kw]);
    ofertas.push(...resultado);
    await sleep(1500);
  }

  // Deduplica por URL
  const mapa = new Map();
  for (const o of ofertas) {
    if (!mapa.has(o.url)) mapa.set(o.url, o);
  }

  return Array.from(mapa.values());
}

module.exports = { obtenerOfertas };
