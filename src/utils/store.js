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

// require perezoso: en local el paquete no hace falta para nada
let blobSdk = null;
function sdk() {
  if (!blobSdk) blobSdk = require('@vercel/blob');
  return blobSdk;
}

// Cachea pathname → url para no hacer un list() en cada lectura
const urlCache = new Map();

async function blobUrl(clave) {
  if (urlCache.has(clave)) return urlCache.get(clave);
  const { blobs } = await sdk().list({ prefix: clave, limit: 10 });
  const blob = blobs.find((b) => b.pathname === clave);
  if (!blob) return null;
  urlCache.set(clave, blob.url);
  return blob.url;
}

async function blobLeer(clave) {
  const url = await blobUrl(clave);
  if (!url) return null;
  // El CDN de Blob cachea por URL: la query única fuerza contenido fresco
  const res = await fetch(`${url}?v=${Date.now()}`);
  if (!res.ok) return null;
  return res.text();
}

async function blobEscribir(clave, texto) {
  const { url } = await sdk().put(clave, texto, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60, // mínimo que permite Blob
  });
  urlCache.set(clave, url);
}

async function blobListar(prefijo) {
  const { blobs } = await sdk().list({ prefix: prefijo, limit: 1000 });
  return blobs.map((b) => b.pathname);
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
  if (usaBlob()) return (await blobUrl(clave)) !== null;
  return fs.existsSync(path.join(RAIZ, clave));
}

module.exports = { leerTexto, escribirTexto, leerJSON, escribirJSON, listar, existe, usaBlob };
