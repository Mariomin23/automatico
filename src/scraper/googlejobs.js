const { chromium } = require('playwright');

const HEADERS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function obtenerOfertas(keywords) {
  const query = encodeURIComponent(keywords.slice(0, 3).join(' ') + ' Madrid');
  const url = `https://www.google.com/search?q=${query}&ibp=htl;jobs`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const contexto = await browser.newContext({ userAgent: HEADERS_UA });
    const pagina = await contexto.newPage();

    await pagina.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await sleep(2000);

    // Google Jobs renderiza las ofertas en li dentro del panel de empleos
    const ofertas = await pagina.evaluate(() => {
      const resultados = [];
      const items = document.querySelectorAll('li[data-ved]');

      items.forEach((item) => {
        const titulo = item.querySelector('[class*="title"]')?.innerText?.trim();
        const empresa = item.querySelector('[class*="company"]')?.innerText?.trim();
        const descripcion = item.querySelector('[class*="snippet"]')?.innerText?.trim();

        if (!titulo) return;

        resultados.push({
          titulo,
          empresa: empresa || 'Desconocida',
          url: window.location.href,
          descripcion: descripcion || '',
          fuente: 'GoogleJobs',
        });
      });

      return resultados;
    });

    return ofertas;
  } catch (err) {
    console.error(`[GoogleJobs] Error al scrapear: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { obtenerOfertas };
