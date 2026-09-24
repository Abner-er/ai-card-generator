import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const path = require('path');

const PORT = 5178;
const SHOT_DIR = path.resolve('verify-shots-brick');
const CHROME = 'C:\\Users\\Administrator\\.workbuddy\\binaries\\chrome\\chrome\\win64-138.0.7204.92\\chrome-win64\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = require('fs');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 1000, deviceScaleFactor: 1 });
page.on('console', (m) => console.log(`PAGE-${m.type()}:`, m.text()));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

// 选「手绘涂鸦」风格
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '手绘涂鸦');
  if (b) b.click();
});

// 填主题
await page.evaluate(() => {
  const ta = document.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '向日葵的一生：从一颗种子到金色花盘');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});

// 点拆解
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('拆解知识并生成'));
  if (b) b.click();
});

// 等底图出现
let baseReady = false;
for (let i = 0; i < 40; i++) {
  baseReady = await page.evaluate(() => !!document.querySelector('img[src^="data:image"]'));
  if (baseReady) break;
  await sleep(500);
}
console.log('底图/baseBar ready=', baseReady);

// 等所有模块生成完成（不再有「生成中…」）
let allDone = false;
for (let i = 0; i < 60; i++) {
  const generating = await page.evaluate(() => [...document.querySelectorAll('*')].some((x) => x.textContent.trim() === '生成中…'));
  if (!generating) { allDone = true; break; }
  await sleep(500);
}
console.log('allDone=', allDone);
await sleep(800);
await page.screenshot({ path: path.resolve(SHOT_DIR, 'board.png') });
console.log('截图 board.png');

// 拼长图导出
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('拼长图导出'));
  if (b) b.click();
});
await sleep(12000);
await page.screenshot({ path: path.resolve(SHOT_DIR, 'export.png') });
console.log('截图 export.png');

// 读取 toast
const toastText = await page.evaluate(() => {
  const el = document.querySelector('[style*="translateX(-50%)"]');
  return el ? el.textContent : '';
});
console.log('toast=', toastText);

// 导出页是否出现长图
const hasLong = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')];
  return imgs.some((x) => x.src.startsWith('data:image/png') && x.src.length > 5000);
});
console.log('export long image present=', hasLong);

await browser.close();
console.log('DONE');
