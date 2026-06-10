const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function slug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Slug único por oferta: dos ofertas de la misma empresa no comparten carta
function slugOferta(oferta) {
  const hash = crypto.createHash('md5').update(oferta.url).digest('hex').slice(0, 6);
  return `${slug(oferta.empresa)}_${hash}`;
}

// Fecha local YYYY-MM-DD (toISOString usaría UTC: de madrugada caería en el día anterior)
function fechaHoy() {
  return new Date().toLocaleDateString('sv-SE');
}

function carpetaHoy() {
  const carpeta = path.join(__dirname, '../../output', fechaHoy());
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
  return carpeta;
}

function generarResumen(ofertas) {
  const carpeta = carpetaHoy();
  const hoy = fechaHoy();

  let md = `# Resumen de ofertas — ${hoy}\n\nTotal: **${ofertas.length}**\n\n---\n\n`;

  for (const oferta of ofertas) {
    md += `## ${oferta.nueva ? '🆕 ' : ''}${oferta.empresa} — ${oferta.titulo}\n\n`;
    md += `**Fuente:** ${oferta.fuente}  \n`;
    md += `**URL:** ${oferta.url}  \n`;
    if (oferta.salario) md += `**Salario:** ${oferta.salario}  \n`;
    if (oferta.modalidad) md += `**Modalidad:** ${oferta.modalidad}  \n`;
    if (oferta.descripcion) md += `**Descripción:** ${oferta.descripcion.slice(0, 200)}  \n`;
    md += '\n---\n\n';
  }

  const rutaResumen = path.join(carpeta, 'resumen.md');
  fs.writeFileSync(rutaResumen, md, 'utf-8');

  const json = {
    fecha: hoy,
    total: ofertas.length,
    ofertas: ofertas.map((o) => ({
      titulo: o.titulo,
      empresa: o.empresa,
      url: o.url,
      fuente: o.fuente,
      descripcion: o.descripcion || '',
      slug: slugOferta(o),
      nueva: !!o.nueva,
      salario: o.salario || '',
      modalidad: o.modalidad || '',
    })),
  };
  fs.writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify(json, null, 2), 'utf-8');

  return rutaResumen;
}

module.exports = { generarResumen };
