const llm = require('./llm');
const { promptCarta } = require('./prompts');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
  const hora = new Date().toTimeString().slice(0, 5);
  console.log(`[${hora}] ${msg}`);
}

async function generarCarta(oferta) {
  try {
    return await llm.generar(promptCarta(oferta));
  } catch (err) {
    console.error(`[LetterWriter] Error LLM para "${oferta.empresa}": ${err.message}`);
    return null;
  }
}

async function generarCartas(ofertasAptas) {
  log(`Generando cartas para ${ofertasAptas.length} ofertas...`);
  const resultados = [];

  for (const oferta of ofertasAptas) {
    const carta = await generarCarta(oferta);
    if (carta) {
      resultados.push({ ...oferta, carta });
    }
    await sleep(1100);
  }

  log(`Cartas generadas: ${resultados.length}`);
  return resultados;
}

module.exports = { generarCarta, generarCartas };
