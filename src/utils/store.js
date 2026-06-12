const fs = require('fs');
const path = require('path');

// Capa de almacenamiento con dos backends y la misma interfaz async:
// - Disco local (desarrollo): las claves son rutas relativas a la raíz del proyecto.
// - Vercel Blob (producción): se activa solo cuando existe BLOB_READ_WRITE_TOKEN,
//   que Vercel inyecta automáticamente al conectar un Blob store al proyecto.
//
// Claves de ejemplo: "data/seen_jobs.json", "output/2026-06-12/resumen.json"

const RAIZ = path.join(__dirname, '../..');

function usaBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// ── Backend disco local ───────────────────────────────────────────────────────

async function fsLeer(clave) {
  const ruta = path.join(RAIZ, clave);
  if (!fs.existsSync(ruta)) return null;
  return fs.readFileSync(ruta, 'utf-8');
}

async function fsEscribir(clave, texto) {
  const ruta = path.join(RAIZ, clave);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, texto, 'utf-8');
}

function caminar(dir) {
  const rutas = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) rutas.push(...caminar(ruta));
    else rutas.push(ruta);
  }
  return rutas;
}

async function fsListar(prefijo) {
  const base = path.join(RAIZ, prefijo);
  if (!fs.existsSync(base)) return [];
  return caminar(base).map((r) => path.relative(RAIZ, r).split(path.sep).join('/'));
}

// ── Backend Vercel Blob ───────────────────────────────────────────────────────
//
// Sobrescribir un mismo pathname en Blob tarda hasta 60s en propagarse por su
// CDN (lecturas obsoletas). Solución: cada escritura crea un pathname NUEVO
// ("clave/v<timestamp>") y la lectura resuelve la última versión con list().
// El contenido de cada versión es inmutable, así que la caché no estorba.
// Las versiones antiguas se borran tras escribir (best effort).

// require perezoso: en local el paquete no hace falta para nada
let blobSdk = null;
function sdk() {
  if (!blobSdk) blobSdk = require('@vercel/blob');
  return blobSdk;
}

const SEP_VERSION = '/v';

// Última versión de una clave: pathname "clave/v<ts>" con el ts más alto
async function blobUltimaVersion(clave) {
  const { blobs } = await sdk().list({ prefix: `${clave}${SEP_VERSION}`, limit: 1000 });
  if (!blobs.length) return null;
  blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
  return blobs[0];
}

async function blobLeer(clave) {
  const version = await blobUltimaVersion(clave);
  if (!version) return null;
  const res = await fetch(version.url);
  if (!res.ok) return null;
  return res.text();
}

async function blobEscribir(clave, texto) {
  // timestamp con padding fijo para que el orden lexicográfico = orden temporal
  const ts = String(Date.now()).padStart(15, '0');
  await sdk().put(`${clave}${SEP_VERSION}${ts}`, texto, {
    access: 'public',
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });

  // Borra versiones anteriores; si falla no pasa nada (leer coge la última)
  try {
    const { blobs } = await sdk().list({ prefix: `${clave}${SEP_VERSION}`, limit: 1000 });
    const viejas = blobs.filter((b) => !b.pathname.endsWith(`${SEP_VERSION}${ts}`)).map((b) => b.url);
    if (viejas.length) await sdk().del(viejas);
  } catch { /* limpieza best effort */ }
}

async function blobListar(prefijo) {
  const { blobs } = await sdk().list({ prefix: prefijo, limit: 1000 });
  // Quita el sufijo de versión y deduplica: devuelve claves lógicas
  return [...new Set(
    blobs.map((b) => {
      const i = b.pathname.lastIndexOf(SEP_VERSION);
      return i === -1 ? b.pathname : b.pathname.slice(0, i);
    })
  )];
}

// ── Interfaz pública ──────────────────────────────────────────────────────────

async function leerTexto(clave) {
  return usaBlob() ? blobLeer(clave) : fsLeer(clave);
}

async function escribirTexto(clave, texto) {
  return usaBlob() ? blobEscribir(clave, texto) : fsEscribir(clave, texto);
}

async function leerJSON(clave, fallback = null) {
  const texto = await leerTexto(clave);
  if (texto == null) return fallback;
  try {
    return JSON.parse(texto);
  } catch {
    return fallback;
  }
}

async function escribirJSON(clave, datos) {
  return escribirTexto(clave, JSON.stringify(datos, null, 2));
}

// Devuelve las claves completas bajo un prefijo, p.ej. listar('output/')
async function listar(prefijo) {
  return usaBlob() ? blobListar(prefijo) : fsListar(prefijo);
}

async function existe(clave) {
  if (usaBlob()) return (await blobUltimaVersion(clave)) !== null;
  return fs.existsSync(path.join(RAIZ, clave));
}

module.exports = { leerTexto, escribirTexto, leerJSON, escribirJSON, listar, existe, usaBlob };
