require('dotenv').config();

process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

const { puntuarOfertas } = require('./src/ai/scorer');
const { generarCartas } = require('./src/ai/letterWriter');

const ofertaEjemplo = {
  id: 'test-001',
  titulo: 'Desarrollador Fullstack Junior (Node.js + React)',
  empresa: 'Startup Tech Madrid',
  descripcion: `Buscamos un desarrollador fullstack junior para unirse a nuestro equipo en Madrid.

Requisitos:
- Node.js y Express para el backend
- React o Angular para el frontend
- MongoDB o PostgreSQL
- Conocimientos de TypeScript
- Git y metodologías ágiles
- Se valora experiencia con REST APIs y JWT

Ofrecemos:
- Salario: 22.000 - 28.000 €/año
- Modalidad híbrida (3 días oficina, 2 remoto)
- Oficina en Madrid centro
- Equipo joven y buen ambiente
- Posibilidad de crecimiento rápido`,
  url: 'https://example.com/oferta-test-001',
};

async function main() {
  console.log('=== TEST: Puntuación de oferta ===\n');

  const puntuadas = await puntuarOfertas([ofertaEjemplo]);

  if (!puntuadas.length) {
    console.error('No se obtuvo puntuación.');
    process.exit(1);
  }

  const resultado = puntuadas[0];
  console.log('\n--- Resultado puntuación ---');
  console.log(`Puntuación: ${resultado.puntuacion}/10`);
  console.log(`Apto: ${resultado.apto}`);
  console.log(`Motivo: ${resultado.motivo}`);
  console.log(`Keywords match: ${resultado.keywords_match.join(', ')}`);
  console.log(`Alerta: ${resultado.alerta}`);

  if (resultado.apto) {
    console.log('\n=== TEST: Generación de carta ===\n');
    const conCartas = await generarCartas([resultado]);

    if (conCartas.length) {
      console.log('\n--- Carta generada ---\n');
      console.log(conCartas[0].carta);
    }
  } else {
    console.log('\nOferta no apta — no se genera carta.');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
