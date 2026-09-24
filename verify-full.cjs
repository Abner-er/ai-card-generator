const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHROME = 'C:\\Users\\Administrator\\.workbuddy\\binaries\\chrome\\chrome\\win64-138.0.7204.92\\chrome-win64\\chrome.exe';
const OUT = path.resolve(__dirname, 'verify-full');
const DL = path.join(OUT, 'download');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  fs.mkdirSync(DL, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 1100, deviceScaleFactor: 1.5 });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });

  // 1) 输入主题
  await page.waitForSelector('textarea', { timeout: 15000 });
  await page.type('textarea', '光合作用：绿色植物如何利用阳光把二氧化碳和水变成养分');

  // 2) 选风格（清新水彩 = bujo，标题荧光块）
  const picked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => (x.textContent || '').includes('清新水彩'));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('[style] picked watercolor =', picked);

  // 3) 点生成
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => (x.textContent || '').includes('拆解知识'));
    if (b) b.click();
  });

  // 4) 等棋盘页出现
  await page.waitForSelector('[data-span]', { timeout: 30000 });
  console.log('[board] appeared');

  // 5) 等所有图片 loaded（真实 Agnes）
  const deadline = Date.now() + 280000;
  let lastCount = -1;
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-span]'));
      let imgs = 0, done = 0, err = 0;
      cards.forEach((c) => {
        const img = c.querySelector('img');
        if (img && img.getAttribute('src') && img.getAttribute('src').startsWith('http')) imgs++;
        const txt = c.textContent || '';
        if (txt.includes('生成中')) done++;
        if (txt.includes('⚠')) err++;
      });
      return { total: cards.length, withImg: imgs, pending: done, err };
    });
    if (st.total && st.withImg === st.total && st.pending === 0) {
      console.log('[done] all', st.total, 'modules loaded');
      break;
    }
    if (st.err > 0) { console.log('[warn]', st.err, 'module(s) errored'); }
    if (st.withImg !== lastCount) console.log('[progress]', st.withImg + '/' + st.total, 'images');
    lastCount = st.withImg;
    await sleep(3000);
  }

  await sleep(500);
  const boardPath = path.join(OUT, 'board.png');
  await page.screenshot({ path: boardPath, fullPage: true });
  console.log('[shot] board.png saved');

  // 6) 下载 zip
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => (x.textContent || '').includes('下载单图'));
    if (b) b.click();
  });
  console.log('[zip] clicked download');

  // 7) 等 zip 出现
  let zipPath = null;
  for (let i = 0; i < 60; i++) {
    const files = fs.readdirSync(DL).filter((f) => f.endsWith('.zip'));
    if (files.length) {
      zipPath = path.join(DL, files[0]);
      // 等文件大小稳定
      const s1 = fs.statSync(zipPath).size;
      await sleep(800);
      const s2 = fs.statSync(zipPath).size;
      if (s1 === s2) break;
    }
    await sleep(1000);
  }
  if (!zipPath) { console.log('[zip] NOT found'); await browser.close(); process.exit(1); }
  console.log('[zip] saved:', zipPath, fs.statSync(zipPath).size, 'bytes');

  // 8) 解压
  const extract = path.join(OUT, 'extracted');
  fs.rmSync(extract, { recursive: true, force: true });
  fs.mkdirSync(extract, { recursive: true });
  execSync(`powershell -Command "Expand-Archive -Force '${zipPath.replace(/'/g, "''")}' '${extract.replace(/'/g, "''")}'"`, { stdio: 'inherit' });

  const pngs = fs.readdirSync(extract).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  console.log('[zip] png count =', pngs.length);
  pngs.forEach((f) => console.log('   ', f, fs.statSync(path.join(extract, f)).size, 'bytes'));

  // 9) 复制前 4 张到 OUT 便于查看
  for (let i = 0; i < Math.min(4, pngs.length); i++) {
    fs.copyFileSync(path.join(extract, pngs[i]), path.join(OUT, 'zip-' + String(i + 1).padStart(2, '0') + '-' + pngs[i]));
  }

  console.log('[errors] console errors =', errors.length);
  errors.slice(0, 10).forEach((e) => console.log('   !', e));

  await browser.close();
  console.log('[done] verify-full completed');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
