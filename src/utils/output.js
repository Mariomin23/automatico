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

function generarResumen(ofertas) {
  const carpeta = carpetaHoy();
  const hoy = new Date().toISOString().slice(0, 10);

  let md = `# Resumen de ofertas — ${hoy}\n\nTotal: **${ofertas.length}**\n\n---\n\n`;

  for (const oferta of ofertas) {
    md += `## ${oferta.empresa} — ${oferta.titulo}\n\n`;
    md += `**Fuente:** ${oferta.fuente}  \n`;
    md += `**URL:** ${oferta.url}  \n`;
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
      slug: slug(o.empresa),
    })),
  };
  fs.writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify(json, null, 2), 'utf-8');

  return rutaResumen;
}

module.exports = { generarResumen };
