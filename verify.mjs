import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Users\\Administrator\\.workbuddy\\binaries\\chrome\\chrome\\win64-138.0.7204.92\\chrome-win64\\chrome.exe';
const BASE = 'http://localhost:5199';
const styles = [
  { id: 'flat', label: '扁平插画' },
  { id: 'chalkboard', label: '黑板粉笔' },
  { id: 'riso', label: '复古印刷' },
  { id: 'minimal', label: '极简线条' },
  { id: 'watercolor', label: '清新水彩' },
  { id: 'comic', label: '波普漫画' },
  { id: 'cyber', label: '赛博霓虹' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  for (const s of styles) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1180, height: 1600, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.waitForSelector('textarea');
    await page.type('textarea', '向日葵的一生');

    const clicked = await page.evaluate((label) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((x) => (x.textContent || '').trim() === label);
      if (b) { b.click(); return true; }
      return false;
    }, s.label);
    if (!clicked) console.log('WARN preset not found:', s.label);

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').includes('拆解知识并生成'));
      if (btn) btn.click();
    });

    await page.waitForSelector('img[src^="data:image/png"]', { timeout: 30000 });
    await sleep(2000);

    const count = await page.evaluate(() => document.querySelectorAll('img[src^="data:image/png"]').length);
    const firstCardText = await page.evaluate(() => {
      const info = document.querySelector('[data-span] div');
      return info ? info.textContent.slice(0, 40) : '';
    });
    await page.screenshot({ path: `verify-${s.id}.png`, fullPage: true });
    console.log(`[${s.id}] presetClicked=${clicked} images=${count} errors=${errors.length} firstCard="${firstCardText}"`);
    if (errors.length) console.log('  CONSOLE ERRORS:\n' + errors.slice(0, 6).join('\n'));
    await page.close();
  }
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
