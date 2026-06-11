const axios = require('axios');

// API REST oficial de InfoJobs (developer.infojobs.net).
// Auth: HTTP Basic con clientId:clientSecret de la app registrada.
// La búsqueda de ofertas es pública (no necesita OAuth de usuario);
// el OAuth/Bearer solo hace falta para datos privados (CV, candidaturas).
const OFFER_URL = 'https://api.infojobs.net/api/9/offer';
const PAGINAS = 2;
const MAX_RESULTS = 30;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function credenciales() {
  const id = process.env.INFOJOBS_CLIENT_ID;
  const secret = process.env.INFOJOBS_CLIENT_SECRET;
  if (!id || !secret) return null;
  return Buffer.from(`${id}:${secret}`).toString('base64');
}

function hayCredenciales() {
  return credenciales() !== null;
}

// Texto plano (".value") aunque InfoJobs lo mande como objeto {value,id} o como string
function valor(campo) {
  if (campo == null) return '';
  return typeof campo === 'object' ? (campo.value || '') : String(campo);
}

function formatearSalario(o) {
  if (o.salaryDescription) return o.salaryDescription;
  const min = valor(o.salaryMin);
  const max = valor(o.salaryMax);
  const periodo = valor(o.salaryPeriod);
  if (!min && !max) return '';
  const rango = min && max && min !== max ? `${min}–${max}` : (min || max);
  return periodo ? `${rango} (${periodo})` : rango;
}

function aOferta(o) {
  return {
    titulo: o.title || '',
    empresa: (o.author && o.author.name) || 'Desconocida',
    // link ya viene como URL absoluta https://www.infojobs.net/...
    url: (o.link || '').split('?')[0],
    descripcion: (o.requirementMin || o.description || '').slice(0, 300),
    fuente: 'InfoJobs',
    salario: formatearSalario(o),
    modalidad: valor(o.teleworking),
  };
}

async function buscarPagina(authBasic, keyword, provincia, pagina) {
  try {
    const res = await axios.get(OFFER_URL, {
      params: {
        q: keyword,
        province: provincia,
        order: 'relevancia-desc',
        maxResults: MAX_RESULTS,
        page: pagina,
      },
      headers: {
        Authorization: `Basic ${authBasic}`,
        Accept: 'application/json',
      },
      timeout: 12000,
    });
    const offers = res.data && Array.isArray(res.data.offers) ? res.data.offers : [];
    return offers.filter((o) => o.title && o.link).map(aOferta);
  } catch (err) {
    const status = err.response && err.response.status;
    if (status === 401) {
      console.error('[InfoJobs API] 401: credenciales INFOJOBS_CLIENT_ID/SECRET inválidas');
    } else {
      console.error(`[InfoJobs API] Error "${keyword}" p${pagina}: ${status || err.message}`);
    }
    return [];
  }
}

// keywords: string[]; provincia: nombre p.ej. "Madrid"
async function obtenerOfertas(keywords = [], provincia = 'Madrid') {
  const authBasic = credenciales();
  if (!authBasic) return [];

  const todas = [];
  for (const kw of keywords.slice(0, 3)) {
    for (let p = 1; p <= PAGINAS; p++) {
      todas.push(...(await buscarPagina(authBasic, kw, provincia, p)));
      await sleep(800);
    }
  }

  const mapa = new Map();
  for (const o of todas) {
    if (o.url && !mapa.has(o.url)) mapa.set(o.url, o);
  }
  return Array.from(mapa.values());
}

module.exports = { obtenerOfertas, hayCredenciales };
