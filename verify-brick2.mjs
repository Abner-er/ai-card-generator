import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const puppeteer = require('puppeteer-core');

const URL = 'http://localhost:5179/';
const SHOT_DIR = path.resolve('verify-shots-brick2');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fs = require('fs');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const CHROME = 'C:\\Users\\Administrator\\.workbuddy\\binaries\\chrome\\chrome\\win64-138.0.7204.92\\chrome-win64\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1400, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // 选手绘涂鸦
  const picked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '手绘涂鸦');
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('选手绘涂鸦:', picked);

  // 填主题
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, '白鹭的一生：从破壳雏鸟到湿地飞翔的完整成长过程');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // 点击拆解
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('拆解知识并生成模块图'));
    if (b) b.click();
  });

  // 等积木面板出现
  let boardReady = false;
  for (let i = 0; i < 60; i++) {
    boardReady = await page.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('拼长图导出')));
    if (boardReady) break;
    await sleep(500);
  }
  // 等所有模块生成完成
  for (let i = 0; i < 60; i++) {
    const done = await page.evaluate(() => {
      const cards = document.querySelectorAll('[style*="grid-column"]');
      // 统计已生成（img 在 card 内）
      let total = 0, doneCount = 0;
      cards.forEach((c) => {
        total++;
        if (c.querySelector('img')) doneCount++;
      });
      return { total, doneCount };
    });
    if (done.total > 0 && done.doneCount === done.total) { console.log('all modules done', done); break; }
    await sleep(500);
  }
  await sleep(800);
  await page.screenshot({ path: path.resolve(SHOT_DIR, 'board.png') });

  // 读取每个卡片的 span
  const spans = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-span]')].map((c) => ({
      span: c.getAttribute('data-span'),
      hasImg: !!c.querySelector('img'),
    }));
  });
  console.log('SPAN RHYTHM:', JSON.stringify(spans));

  // 点击拼长图导出
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('拼长图导出'));
    if (b) b.click();
  });
  // 等导出页出现（标题变化为「导出 · ...」）
  let exportReady = false;
  for (let i = 0; i < 40; i++) {
    exportReady = await page.evaluate(() => document.body.innerText.includes('导出 ·'));
    if (exportReady) break;
    await sleep(500);
  }
  console.log('export page ready=', exportReady);
  await sleep(800);
  await page.screenshot({ path: path.resolve(SHOT_DIR, 'export.png') });
  const longSrc = await page.evaluate(() => {
    const img = [...document.querySelectorAll('img')].find((x) => x.src.startsWith('data:image/png'));
    return img ? img.src : null;
  });
  if (longSrc) {
    const b64 = longSrc.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.resolve(SHOT_DIR, 'long.png'), Buffer.from(b64, 'base64'));
    console.log('saved long.png', b64.length, 'chars');
  } else {
    console.log('no long image found');
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
