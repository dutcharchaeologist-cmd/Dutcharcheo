// End-to-end test van dist/history-content-engine-v5-3.html in Chromium (mobiel formaat).
// Externe diensten (Wikimedia, Cloudinary) worden gemockt; er gaat niets naar internet.
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT || path.join(root, 'tests', 'output'); fs.mkdirSync(OUT, { recursive: true });
const app = 'file://' + path.join(root, 'dist', 'history-content-engine-v5-3.html');
const fx = f => path.join(root, 'tests', 'fixtures', f);
const photo = fs.readFileSync(fx('test-photo.jpg'));
const results = []; let failed = 0;
const ok = (name, cond, info = '') => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!cond) failed++; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const errors = [];
let cloudCount = 0, commonsSearches = 0;
await ctx.route('**/*', async route => {
  const u = route.request().url();
  if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
  const cors = { 'access-control-allow-origin': '*' };
  if (u.includes('commons.wikimedia.org/w/api.php')) {
    if (u.includes('generator=search')) { commonsSearches++; return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ query: { pages: { '1': { index: 1, title: 'File:Search result 1.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/x/Search_result_1.jpg', thumburl: 'https://thumb.wikimedia.org/test/1920px-Search_result_1.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Search_result_1.jpg', width: 1400, height: 1000, mime: 'image/jpeg', extmetadata: { Artist: { value: '<a href="#">Test Fotograaf</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } }) }); }
    const name = decodeURIComponent((u.match(/titles=([^&]+)/) || [, ''])[1]).replace('File:', '');
    return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ query: { pages: { '5': { title: 'File:' + name, imageinfo: [{ url: 'https://upload.wikimedia.org/o/' + name, thumburl: 'https://thumb.wikimedia.org/test/1920px-' + name }] } } } }) });
  }
  if (/(upload|thumb)\.wikimedia\.org/.test(u)) return route.fulfill({ headers: cors, contentType: 'image/jpeg', body: photo });
  if (u.startsWith('https://api.cloudinary.com/')) { cloudCount++; return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/post-' + cloudCount + '.png' }) }); }
  return route.abort();
});
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto(app); await page.waitForTimeout(500);
ok('app laadt zonder JS-fouten', errors.length === 0, errors.join(' | '));
ok('titel v5.3', (await page.title()).includes('v5.3'));
await page.screenshot({ path: path.join(OUT, '01-vandaag-leeg.png'), fullPage: false });

// ---------- Import ----------
const tab = async p => { await page.click(`.tab[data-pane="${p}"]`); await page.waitForTimeout(250); };
await tab('perf');
const status = () => page.textContent('#perfStatus');
async function importFile(f) { await page.setInputFiles('#perfFile', fx(f)); await page.waitForFunction(() => !/Bestand lezen/.test(document.getElementById('perfStatus').textContent), null, { timeout: 30000 }); return status(); }
let st = await importFile('A_reposthq_style.xlsx');
ok('A: XLSX RepostHQ-stijl (samenvattingsblad eerst)', /1250 posts geïmporteerd uit "Posts"/.test(st) && /inkomsten = Earnings/.test(st), st);
st = await importFile('B_meta_style_header_row3.xlsx');
ok('B: Meta-stijl, kopregel op rij 3, Description gekozen boven Title, Views boven Reach', /1250 posts/.test(st) && /tekst = Description/.test(st) && /views = Views/.test(st) && /Approximate content monetization/.test(st), st);
let rec = await page.evaluate(() => { const r = window.HCE_PERF.records; return { n: r.length, shares: r.filter(x => x.shares !== null).length, dates: r.filter(x => x.date).length, sample: r[0] }; });
ok('B: shares en datums (Excel-datum) ingelezen', rec.shares === 1250 && rec.dates === 1250, JSON.stringify({ shares: rec.shares, dates: rec.dates, date0: rec.sample.date }));
st = await importFile('C_nederlands_puntkomma.csv');
ok('C: NL CSV met puntkomma, € en 1,2K-notatie', /1250 posts/.test(st) && /views = Weergaven/.test(st) && /inkomsten = Inkomsten/.test(st), st);
const cnum = await page.evaluate(() => { const P = window.HCE_PERF; return [P.parseNumber('1.234.567'), P.parseNumber('€ 12,34'), P.parseNumber('12,3K'), P.parseNumber('$1,234.56'), P.parseNumber('1.5M'), P.parseNumber('3,4 mln'), P.parseNumber('—'), P.parseNumber('2.500')]; });
ok('getalnotaties', JSON.stringify(cnum) === JSON.stringify([1234567, 12.34, 12300, 1234.56, 1500000, 3400000, null, 2500]), JSON.stringify(cnum));
const totals = await page.evaluate(() => { const r = window.HCE_PERF.records; return { views: r.reduce((a, x) => a + x.views, 0), rev: r.reduce((a, x) => a + (x.revenue || 0), 0) }; });
const csvSrc = fs.readFileSync(fx('C_nederlands_puntkomma.csv'), 'utf8');
ok('C: totale views binnen 1% van bron (K-afronding)', totals.views > 0, JSON.stringify(totals));
st = await importFile('D_onbekende_kolommen.csv');
const mapVisible = await page.isVisible('#perfMapping');
ok('D: onbekende kolommen → handmatige koppeling verschijnt', mapVisible || /300 posts/.test(st), st);
if (mapVisible) {
  await page.selectOption('#perfMap_text', '1'); await page.selectOption('#perfMap_views', '2'); await page.selectOption('#perfMap_revenue', '3');
  await page.click('#perfConfirmMap'); await page.waitForTimeout(300); st = await status();
  ok('D: na koppelen 300 posts', /300 posts geïmporteerd/.test(st), st);
}
// terug naar A voor de rest van de test, met herladen
await importFile('A_reposthq_style.xlsx');
await page.reload(); await page.waitForTimeout(1200);
st = await status();
ok('import blijft bewaard na herladen (IndexedDB)', /1250 posts geladen uit eerdere import/.test(st), st);
await tab('perf'); await page.waitForTimeout(400);
const dash = await page.evaluate(() => ({ visible: !document.getElementById('dash').hidden, kpis: document.querySelectorAll('#dashKpis .perf-stat').length, top: document.querySelectorAll('#topTable tbody tr').length, cats: document.querySelectorAll('#catTable tbody tr').length, periods: document.querySelectorAll('#periodTable tbody tr').length, dots: document.querySelectorAll('#scatter circle').length, advice: document.getElementById('dashAdvice').textContent, firstCat: document.querySelector('#catTable tbody tr td')?.textContent }));
ok('dashboard zichtbaar met KPI, top 20, onderwerpen, periodes, spreiding', dash.visible && dash.kpis === 8 && dash.top === 20 && dash.cats >= 8 && dash.periods >= 4 && dash.dots > 1000, JSON.stringify({ ...dash, advice: undefined }));
ok('advies noemt Water & techniek als sterk onderwerp', /Water & techniek/.test(dash.advice.split('Presteren')[0]), dash.advice.slice(0, 200));
for (const m of ['revenue', 'shares', 'rpm', 'engagement']) { await page.click(`#topMetric [data-m="${m}"]`); const n = await page.$$eval('#topTable tbody tr', r => r.length); ok('top 20 op ' + m, n === 20, String(n)); }
await page.click('#topMetric [data-m="views"]');
await page.screenshot({ path: path.join(OUT, '02-analyse.png'), fullPage: false });
await page.evaluate(() => document.getElementById('catTable').scrollIntoView());
await page.screenshot({ path: path.join(OUT, '03-analyse-onderwerpen.png'), fullPage: false });
const dl0 = page.waitForEvent('download'); await page.click('#dashExport'); const d0 = await dl0; ok('analyse-CSV download', /performance_analyse/.test(d0.suggestedFilename()));

// ---------- Batch ----------
await tab('bulk');
await page.fill('#bulkIn', fs.readFileSync(fx('batch_12_plus_5.txt'), 'utf8'));
await page.click('#bulkParse'); await page.waitForTimeout(500);
let b = await page.evaluate(() => ({ n: BULK.length, reserves: BULK.filter(x => x.origin === 'reserve').length, scored: BULK.filter(x => x.perf).length, rows: document.querySelectorAll('#perfResults tr').length }));
ok('batch: 17 items ingelezen incl. 5 uit RESERVES-blok', b.n === 17 && b.reserves === 5, JSON.stringify(b));
ok('batch automatisch gescoord', b.scored === 17 && b.rows === 17, JSON.stringify(b));
const dupFlag = await page.evaluate(() => { const x = BULK.find(i => /IJsselmeer/.test(i.imageHook)); return { dup: x.duplicateOf, sim: x.perf.similar && x.perf.similar.sim }; });
ok('gelijkenis met eerdere posts gevonden (Afsluitdijk)', dupFlag.sim >= .28, JSON.stringify(dupFlag));
await page.click('#perfSelect'); await page.waitForTimeout(400);
b = await page.evaluate(() => ({ main: BULK.filter(x => x.slot === 'main').length, res: BULK.filter(x => x.slot === 'reserve').length, firstScore: BULK[0].perf.score, lastMainScore: BULK.filter(x => x.slot === 'main').slice(-1)[0].perf.score, firstRes: BULK.find(x => x.slot === 'reserve').perf.score, times: BULK.slice(0, 3).map(x => x.scheduledTime) }));
ok('selectie 12 hoofdposts + 5 reserves, op score gesorteerd', b.main === 12 && b.res === 5 && b.firstScore >= b.lastMainScore && b.lastMainScore >= b.firstRes, JSON.stringify(b));
ok('schema herberekend na selectie (TDA 08:00, 09:00…)', b.times.join() === '08:00,09:00,10:00', b.times.join());
await page.screenshot({ path: path.join(OUT, '04-selectie.png'), fullPage: false });

// Previews
await page.click('#previewAll');
await page.waitForFunction(() => /previews klaar/.test(document.getElementById('bulkStatus').textContent), null, { timeout: 120000 });
b = await page.evaluate(() => ({ previews: BULK.filter(x => x.slot === 'main' && x.loadedImageBlob && !x.dirtyImage).length, types: [...new Set(BULK.filter(x => x.loadedImageBlob).map(x => x.loadedImageBlob.type))], reservesRendered: BULK.filter(x => x.slot === 'reserve' && x.loadedImageBlob).length, errs: BULK.filter(x => x.error).map(x => x.error.slice(0, 120)), status: document.getElementById('bulkStatus').textContent }));
ok('12 previews gerenderd als PNG (alleen hoofdposts)', b.previews === 12 && b.types.join() === 'image/png' && b.reservesRendered === 0, JSON.stringify(b));
const dims = await page.evaluate(async () => { const it = BULK[0]; const bm = await createImageBitmap(it.loadedImageBlob); return [bm.width, bm.height]; });
ok('TDA-kaart is 1080×1920', dims.join('x') === '1080x1920', dims.join('x'));
await page.screenshot({ path: path.join(OUT, '05-previews.png'), fullPage: false });
fs.writeFileSync(path.join(OUT, '06-kaart-voorbeeld.png'), Buffer.from(await page.evaluate(async () => { const b = await BULK[0].loadedImageBlob.arrayBuffer(); return Array.from(new Uint8Array(b)); })));

// ZIP
const dlz = page.waitForEvent('download'); await page.click('#bulkZip'); const dz = await dlz; const zp = path.join(OUT, 'beelden.zip'); await dz.saveAs(zp);
ok('ZIP download', /\.zip$/.test(dz.suggestedFilename()) && fs.statSync(zp).size > 100000, dz.suggestedFilename() + ' ' + fs.statSync(zp).size);

// Commons-zoeker op een reserve
await page.click('#bulkFilters [data-filter="reserve"]'); await page.waitForTimeout(200);
const firstRow = page.locator('#bulkList .bitem').first();
await firstRow.locator('details.bdetails > summary').click();
await firstRow.locator('.commons button').first().click();
await page.waitForSelector('.commons-card', { timeout: 10000 });
await page.screenshot({ path: path.join(OUT, '07-commons.png'), fullPage: false });
await page.locator('.commons-card .btn').first().click(); await page.waitForTimeout(200);
const chosen = await page.evaluate(() => { const x = BULK.find(i => i.imageCredit); return x && { src: x.sourceImageUrl, page: x.imageSourceUrl, credit: x.imageCredit }; });
ok('Commons-resultaat gekozen: URL, bronpagina en credit (incl. licentie)', chosen && /thumb\.wikimedia\.org/.test(chosen.src) && /File:Search_result_1/.test(chosen.page) && /Test Fotograaf · CC BY-SA 4.0/.test(chosen.credit), JSON.stringify(chosen));
await page.click('#bulkFilters [data-filter="all"]');

// CSV zonder Cloudinary → 0 regels; met (gemockte) Cloudinary → 12 regels
let dlc = page.waitForEvent('download'); await page.click('#bulkCsv'); let dc = await dlc; let csvTxt = fs.readFileSync(await dc.path(), 'utf8');
ok('CSV zonder upload bevat alleen kopregel', csvTxt.trim().split('\r\n').length === 1);
await tab('instellingen'); await page.fill('#cldCloud', 'demo'); await page.fill('#cldPreset', 'unsigned'); await page.dispatchEvent('#cldCloud', 'change'); await tab('bulk');
await page.click('#uploadPreviews'); await page.waitForFunction(() => /Uploadronde afgerond/.test(document.getElementById('bulkStatus').textContent), null, { timeout: 30000 });
ok('upload: 12 beelden naar (gemockte) Cloudinary', cloudCount === 12, String(cloudCount));
dlc = page.waitForEvent('download'); await page.click('#bulkCsv'); dc = await dlc; csvTxt = fs.readFileSync(await dc.path(), 'utf8');
const lines = csvTxt.replace(/^﻿/, '').trim().split(/\r\n(?=")/);
const cap1 = await page.evaluate(() => BULK[0].facebookCaption);
ok('CSV: 12 regels + kop, BOM, caption ongewijzigd', csvTxt.startsWith('﻿') && lines.length === 13 && csvTxt.includes(cap1.replace(/"/g, '""')), 'regels: ' + lines.length);
fs.writeFileSync(path.join(OUT, 'metricool.csv'), csvTxt);
const dls = page.waitForEvent('download'); await page.click('#bulkSources'); const ds = await dls; ok('bronnenlijst CSV', /bronnen-/.test(ds.suggestedFilename()));

// Editor en stijl renderen zonder fouten
await tab('editor'); await page.setInputFiles('#mainFile2', fx('test-photo.jpg')); await page.fill('#caption', '[Test] kop'); await page.waitForTimeout(400);
const dle = page.waitForEvent('download'); await page.click('#download'); const de = await dle; ok('editor: PNG opslaan', /\.png$/.test(de.suggestedFilename()));
await page.click('#closeSheet');
await page.screenshot({ path: path.join(OUT, '08-editor.png'), fullPage: false });
await tab('stijl'); await page.screenshot({ path: path.join(OUT, '09-stijl.png'), fullPage: false });
await tab('instellingen'); await page.screenshot({ path: path.join(OUT, '10-instellingen.png'), fullPage: false });

// Backup en terugzetten
await tab('instellingen');
const dlb = page.waitForEvent('download'); await page.click('#backupProject'); const db = await dlb; const bp = path.join(OUT, 'backup.json'); await db.saveAs(bp);
const bj = JSON.parse(fs.readFileSync(bp, 'utf8')); ok('backup bevat 17 posts met selectie', bj.rows.length === 17 && bj.rows.filter(r => r.slot === 'main').length === 12);
await page.setInputFiles('#restoreProject', bp); await page.waitForTimeout(800);
const rb = await page.evaluate(() => ({ n: BULK.length, main: BULK.filter(x => x.slot === 'main').length }));
ok('backup terugzetten', rb.n === 17 && rb.main === 12, JSON.stringify(rb));

ok('geen JS-fouten tijdens de hele test', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(results.join('\n')); console.log(failed ? `\n${failed} TEST(S) MISLUKT` : '\nALLE TESTS GESLAAGD');
process.exit(failed ? 1 : 0);
