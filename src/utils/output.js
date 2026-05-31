const fs = require('fs');
const path = require('path');

function slug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function carpetaHoy() {
  const hoy = new Date().toISOString().slice(0, 10);
  const carpeta = path.join(__dirname, '../../output', hoy);
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
  return carpeta;
}

function generarResumen(ofertasPuntuadas) {
  const carpeta = carpetaHoy();
  const hoy = new Date().toISOString().slice(0, 10);

  let md = `# Resumen de ofertas — ${hoy}\n\n`;
  md += `Total evaluadas: **${ofertasPuntuadas.length}**  \n`;
  const aptas = ofertasPuntuadas.filter((o) => o.apto);
  md += `Aptas (≥7): **${aptas.length}**\n\n---\n\n`;

  // Primero las aptas, luego el resto
  const ordenadas = [...ofertasPuntuadas].sort((a, b) => b.puntuacion - a.puntuacion);

  for (const oferta of ordenadas) {
    const emoji = oferta.apto ? '✅' : '❌';
    md += `## ${emoji} ${oferta.empresa} — ${oferta.titulo}\n\n`;
    md += `**Puntuación:** ${oferta.puntuacion}/10  \n`;
    md += `**Fuente:** ${oferta.fuente}  \n`;
    md += `**URL:** ${oferta.url}  \n`;
    if (oferta.keywords_match && oferta.keywords_match.length > 0) {
      md += `**Match:** ${oferta.keywords_match.join(', ')}  \n`;
    }
    md += `**Motivo:** ${oferta.motivo}  \n`;
    if (oferta.alerta) {
      md += `**⚠️ Alerta:** ${oferta.alerta}  \n`;
    }
    if (oferta.apto) {
      md += `**Carta:** [${slug(oferta.empresa)}_carta.md](./${slug(oferta.empresa)}_carta.md)  \n`;
    }
    md += '\n---\n\n';
  }

  const rutaResumen = path.join(carpeta, 'resumen.md');
  fs.writeFileSync(rutaResumen, md, 'utf-8');

  // JSON estructurado para el dashboard web
  const json = {
    fecha: hoy,
    total: ofertasPuntuadas.length,
    aptas: aptas.length,
    ofertas: ordenadas.map((o) => ({
      titulo: o.titulo,
      empresa: o.empresa,
      url: o.url,
      fuente: o.fuente,
      puntuacion: o.puntuacion,
      apto: o.apto,
      motivo: o.motivo,
      keywords_match: o.keywords_match || [],
      alerta: o.alerta || null,
      slug: slug(o.empresa),
    })),
  };
  fs.writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify(json, null, 2), 'utf-8');

  return rutaResumen;
}

function guardarCartas(ofertasConCarta) {
  const carpeta = carpetaHoy();
  const rutas = [];

  for (const oferta of ofertasConCarta) {
    const nombre = `${slug(oferta.empresa)}_carta.md`;
    const ruta = path.join(carpeta, nombre);
    const contenido = `# Carta para ${oferta.empresa}\n\n_${oferta.titulo}_\n\n---\n\n${oferta.carta}\n`;
    fs.writeFileSync(ruta, contenido, 'utf-8');
    rutas.push(ruta);
  }

  return rutas;
}

module.exports = { generarResumen, guardarCartas };
