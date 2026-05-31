function promptPuntuacion(oferta) {
  const ofertaTexto = `
Título: ${oferta.titulo}
Empresa: ${oferta.empresa}
Descripción: ${oferta.descripcion}
URL: ${oferta.url}
`.trim();

  return `Eres un asistente que evalúa ofertas de trabajo para un desarrollador fullstack junior.

PERFIL DEL CANDIDATO:
- Stack principal: Node.js, React, Angular, MongoDB, JavaScript, TypeScript
- Formación: Bootcamp Fullstack Neoland 2026, mejor proyecto de la promoción
- Diferenciador: 5 años como autónomo gestionando negocio (P&L, KPIs, equipo)
- Ubicación: Madrid. Acepta presencial, híbrido y remoto.
- Excluir: ofertas que pidan Java, PHP, perfil senior o más de 3 años de experiencia

OFERTA A EVALUAR:
${ofertaTexto}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON:
{
  "puntuacion": <número del 1 al 10>,
  "apto": <true si puntuacion >= 7, false si no>,
  "motivo": "<explicación en 2-3 frases de por qué encaja o no>",
  "keywords_match": ["<tecnologías de la oferta que coinciden con el perfil>"],
  "alerta": "<si hay algo raro en la oferta como salario muy bajo o requisitos contradictorios, ponlo aquí. Si no hay nada, pon null>"
}`;
}

function promptCarta(oferta) {
  const ofertaTexto = `
Título: ${oferta.titulo}
Empresa: ${oferta.empresa}
Descripción: ${oferta.descripcion}
`.trim();

  return `Eres un asistente que escribe cartas de presentación para Mario Minuesa, desarrollador fullstack junior.

PERFIL DE MARIO:
- Stack: Node.js, React, Angular, MongoDB, JavaScript, TypeScript
- Formación: Bootcamp Fullstack Neoland 2026, mejor proyecto de la promoción
- Antes fue autónomo 5 años: Manager en TRIB3 Goya (fitness), gestión P&L, equipo, KPIs
- Email: mario@minuesa.es
- Ubicación: Madrid

OFERTA:
${ofertaTexto}

INSTRUCCIONES PARA LA CARTA:
- Tono: directo, humano, sin sonar a IA ni a plantilla corporativa
- Longitud: 3-4 párrafos, no más
- Menciona siempre 2-3 tecnologías concretas de la oferta que Mario domina
- Incluye el diferenciador del background empresarial de forma natural, no forzada
- No uses frases hechas como "me dirijo a ustedes", "adjunto mi CV", "quedo a su disposición"
- Empieza directamente con algo concreto sobre la empresa o la oferta
- Termina con algo directo y sin florituras

Escribe SOLO la carta, sin asunto, sin fecha, sin "Estimado/a". Solo el cuerpo del texto.`;
}

module.exports = { promptPuntuacion, promptCarta };
