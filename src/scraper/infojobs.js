const axios = require('axios');

const BASE_URL = 'https://www.infojobs.net';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
};
const PAGINAS = 2;
const CITY_MADRID = 28079;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Las ofertas NO están en el HTML (React las pinta en el navegador).
// Van embebidas en: window.__INITIAL_PROPS__ = JSON.parse("...json escapado...")
function extraerProps(html) {
  const marca = html.indexOf('__INITIAL_PROPS__');
  if (marca === -1) return null;

  const parseInicio = html.indexOf('JSON.parse("', marca);
  if (parseInicio === -1) return null;

  const inicio = parseInicio + 'JSON.parse("'.length;
  const fin = html.indexOf('");', inicio);
  if (fin === -1) return null;

  try {
    // Doble parse: el primero des-escapa el string de JS, el segundo lee el JSON real
    return JSON.parse(JSON.parse(`"${html.slice(inicio, fin)}"`));
  } catch {
    return null;
  }
}

function formatearSalario(salary) {
  if (!salary || !salary.range) return '';
  const { min, max } = salary.range;
  if (typeof min !== 'number' && typeof max !== 'number') return '';
  const periodo = { YEAR: 'año', MONTH: 'mes', DAY: 'día', HOUR: 'hora' }[salary.period] || '';
  const fmt = (n) => n.toLocaleString('es-ES');
  const rango = typeof min === 'number' && typeof max === 'number' && min !== max
    ? `${fmt(min)}–${fmt(max)}`
    : fmt(typeof min === 'number' ? min : max);
  return periodo ? `${rango} €/${periodo}` : `${rango} €`;
}

async function scrapearPagina(keyword, pagina) {
  const url = `${BASE_URL}/jobsearch/search-results/list.xhtml?keyword=${encodeURIComponent(keyword)}&cityId=${CITY_MADRID}&page=${pagina}&sortBy=RELEVANCE`;

  let html;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    html = res.data;
  } catch (err) {
    console.error(`[InfoJobs] Error "${keyword}" p${pagina}: ${err.message}`);
    return [];
  }

  const props = extraerProps(html);
  if (!props || !Array.isArray(props.offers)) {
    console.error(`[InfoJobs] Sin datos embebidos para "${keyword}" p${pagina} (¿cambió la página?)`);
    return [];
  }

  return props.offers
    .filter((o) => o.title && o.link)
    // InfoJobs cuela ofertas de otras ciudades aunque se busque por Madrid:
    // solo valen si son de Madrid o 100% en remoto
    .filter((o) => /madrid/i.test(o.city || '') || /remoto/i.test(o.teleworking || ''))
    .map((o) => ({
      titulo: o.title,
      empresa: o.companyName || 'Desconocida',
      // link viene como //www.infojobs.net/...?applicationOrigin=... — fuera query params
      url: `https:${o.link.split('?')[0]}`,
      descripcion: (o.description || '').slice(0, 300),
      fuente: 'InfoJobs',
      salario: formatearSalario(o.salary),
      modalidad: o.teleworking || '',
    }));
}

async function obtenerOfertas(keywords = []) {
  const todas = [];

  for (const kw of keywords.slice(0, 3)) {
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
