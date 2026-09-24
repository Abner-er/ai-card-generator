import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const SHOT_DIR = 'verify-shots-flow';
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

const CHROME = 'C:/Users/Administrator/.workbuddy/binaries/chrome/chrome/win64-138.0.7204.92/chrome-win64/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(800);
await page.screenshot({ path: require('path').resolve(SHOT_DIR, 'step1-input.png') });
console.log('截图 step1-input.png');

// 选「铅笔素描」风格（贴近用户截图风格）
const picked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find((x) => x.textContent.trim() === '铅笔素描');
  if (b) { b.click(); return true; }
  return false;
});
console.log('选铅笔素描:', picked);

// 填文本
await page.evaluate(() => {
  const ta = document.querySelector('textarea');
  if (ta) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'DNS解析全流程：从输入网址到网页加载，DNS如何一步步完成域名到IP的翻译？');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

// 点拆解
const clickedDecompose = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find((x) => x.textContent.includes('拆解知识并生成模块图'));
  if (b) { b.click(); return true; }
  return false;
});
console.log('点拆解:', clickedDecompose);

// 等积木出现（最多 25s）
let boardReady = false;
for (let i = 0; i < 50; i++) {
  boardReady = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((x) => x.textContent.includes('拼长图导出')),
  );
  if (boardReady) break;
  await sleep(500);
}
console.log('boardReady=', boardReady);

// 等至少 4 个模块生成完成，最多 120 秒
let doneCount = 0;
for (let i = 0; i < 240; i++) {
  doneCount = await page.evaluate(() =>
    [...document.querySelectorAll('img')].length,
  );
  console.log('doneCount=', doneCount);
  if (doneCount >= 4) break;
  await sleep(500);
}
await sleep(800);
await page.screenshot({ path: require('path').resolve(SHOT_DIR, 'step2-board.png') });
console.log('截图 step2-board.png, doneCount=', doneCount);

// 点导出
const clickedExport = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find((x) => x.textContent.includes('拼长图导出'));
  if (b) { b.click(); return true; }
  return false;
});
console.log('点导出:', clickedExport);
await sleep(2500);
await page.screenshot({ path: require('path').resolve(SHOT_DIR, 'step3-export.png') });
console.log('截图 step3-export.png');

console.log('=== CONSOLE ERRORS ===');
console.log(errors.length ? errors.join('\n') : '(none)');

await browser.close();
console.log('DONE');
