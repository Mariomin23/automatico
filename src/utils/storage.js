const fs = require('fs');
const path = require('path');

const SEEN_JOBS_PATH = path.join(__dirname, '../../data/seen_jobs.json');

function cargarVistas() {
  if (!fs.existsSync(SEEN_JOBS_PATH)) {
    return [];
  }
  try {
    const contenido = fs.readFileSync(SEEN_JOBS_PATH, 'utf-8');
    return JSON.parse(contenido);
  } catch {
    return [];
  }
}

function guardarVistas(ids) {
  fs.mkdirSync(path.dirname(SEEN_JOBS_PATH), { recursive: true });
  fs.writeFileSync(SEEN_JOBS_PATH, JSON.stringify(ids, null, 2), 'utf-8');
}

function esNueva(url, vistas) {
  return !vistas.includes(url);
}

module.exports = { cargarVistas, guardarVistas, esNueva };
