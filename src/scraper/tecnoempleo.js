const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.tecnoempleo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
};
const PAGINAS = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapearPagina(keyword, pagina) {
  const url = `${BASE_URL}/busqueda-empleo.php?te=${encodeURIComponent(keyword)}&provincia=28&pagina=${pagina}`;

  let html;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    html = res.data;
  } catch (err) {
    console.error(`[Tecnoempleo] Error "${keyword}" p${pagina}: ${err.message}`);
    return [];
  }

  const $ = cheerio.load(html);
  const ofertas = [];

  $('.p-3.border.rounded.mb-3.bg-white').each((_, el) => {
    const titulo = $(el).find('h3 a').text().trim();
    const href = $(el).find('h3 a').attr('href') || '';
    const empresa = $(el).find('a.text-primary').first().text().trim();
    const descripcion = $(el).find('span.hidden-md-down').text().trim();
    const meta = $(el).find('.col-12.col-lg-3').text().trim().replace(/\s+/g, ' ');

    if (!titulo || !href) return;

    ofertas.push({
      titulo,
      empresa: empresa || 'Desconocida',
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      descripcion: descripcion || meta,
      fuente: 'Tecnoempleo',
    });
  });

  return ofertas;
}

async function obtenerOfertas(keywords) {
  const todas = [];

  for (const kw of keywords.slice(0, 5)) {
    for (let p = 1; p <= PAGINAS; p++) {
      const resultado = await scrapearPagina(kw, p);
      todas.push(...resultado);
      await sleep(1200);
    }
  }

  // Deduplica por URL
  const mapa = new Map();
  for (const o of todas) {
    if (!mapa.has(o.url)) mapa.set(o.url, o);
  }

  return Array.from(mapa.values());
}

module.exports = { obtenerOfertas };
