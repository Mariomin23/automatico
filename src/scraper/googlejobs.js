// Google Jobs requiere browser headless (Playwright).
// Para activarlo: npx playwright install chromium
// Mientras tanto devuelve array vacío para no bloquear el flujo.

async function obtenerOfertas(keywords = []) {
  const { chromium } = require('playwright');
  const testPath = require('path').join(
    require('os').homedir(),
    '.cache/ms-playwright'
  );

  const fs = require('fs');
  if (!fs.existsSync(testPath)) {
    console.error('[GoogleJobs] Browsers no instalados. Ejecuta: npx playwright install chromium');
    return [];
  }

  const HEADERS_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
  const query = encodeURIComponent(keywords.slice(0, 3).join(' ') + ' junior Madrid');
  const url = `https://www.google.com/search?q=${query}&ibp=htl;jobs`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const contexto = await browser.newContext({ userAgent: HEADERS_UA });
    const pagina = await contexto.newPage();

    await pagina.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));

    const ofertas = await pagina.evaluate(() => {
      const resultados = [];
      document.querySelectorAll('li[data-ved]').forEach((item) => {
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
    console.error(`[GoogleJobs] Error: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { obtenerOfertas };
