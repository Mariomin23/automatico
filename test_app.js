const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  const title = await page.title();
  const h1 = await page.locator('h1').textContent();
  const runBtn = await page.locator('#runBtn').textContent();
  
  console.log('✓ Página cargada');
  console.log('  Title:', title);
  console.log('  H1:', h1);
  console.log('  Botón:', runBtn);
  
  await page.screenshot({ path: '/tmp/app_screenshot.png', fullPage: true });
  console.log('  Screenshot: /tmp/app_screenshot.png');
  
  await browser.close();
})();
