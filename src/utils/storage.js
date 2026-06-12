const store = require('./store');

const SEEN_JOBS_KEY = 'data/seen_jobs.json';

async function cargarVistas() {
  return (await store.leerJSON(SEEN_JOBS_KEY, [])) || [];
}

async function guardarVistas(ids) {
  await store.escribirJSON(SEEN_JOBS_KEY, ids);
}

function esNueva(url, vistas) {
  return !vistas.includes(url);
}

module.exports = { cargarVistas, guardarVistas, esNueva };
