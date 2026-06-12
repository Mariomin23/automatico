require('dotenv').config();

const { runBusqueda } = require('./run');

runBusqueda().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
