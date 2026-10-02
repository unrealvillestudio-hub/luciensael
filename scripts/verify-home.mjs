// Verificación de la portada en un navegador real (ui-ux-layer §18.6). Complementa a
// `verify-layout.mjs`, que mide desbordes con texto ampliado; ésta mide lo demás.
//
// QUÉ COMPRUEBA
//   1. «Writing» lleva al blog (cabecera, menú móvil y pie), no a la sección.
//   2. La sección Writing tiene un botón visible al blog.
//   3. La sección se llena con /api/blog-latest (simulada aquí) y escribe el título como
//      TEXTO: un título con HTML no se ejecuta.
//   4. Si la ruta falla (503) o viene vacía, queda el respaldo escrito: nunca una sección vacía.
//   5. Ninguna forma derogada del logotipo de UNRLVL («UNREAL>ILLE») en la página.
//   6. Objetivos táctiles ≥ 44 px en el teléfono, medidos con getBoundingClientRect.
//   7. Las familias cargadas son las del BP, servidas desde el propio dominio.
//   8. Menú móvil: abre, bloquea el scroll, atrapa el foco, cierra con Escape.
//   9. Cero errores de página en 360 · 390 · 768 · 1280 · 1440.
//
// CÓMO SE CORRE:  PLAYWRIGHT_MODULE="$(npm root -g)/playwright/index.mjs" node scripts/verify-home.mjs
// Capturas en $SHOTS_DIR si se define.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.js': 'text/javascript' };
const SHOTS = process.env.SHOTS_DIR || null;

let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch { console.error('Playwright no está disponible. Ver la cabecera de este archivo.'); process.exit(2); }
const chromium = pw.chromium ?? pw.default?.chromium;

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

const FIXTURE = {
  blog_path: '/blog',
  posts: [
    { href: '/blog/pieza-nueva-1', title: 'Pieza nueva <img src=x onerror="window.__xss=1">', excerpt: 'Extracto uno.', topic: 'Behavioral Science', language: 'en', published_iso: '2026-10-01T12:00:00Z' },
    { href: '/blog/pieza-nueva-2', title: 'Segunda pieza', excerpt: 'Extracto dos.', topic: null, language: 'es', published_iso: '2026-09-20T12:00:00Z' },
    { href: '/blog/the-intelligence-was-never-artificial', title: 'The intelligence was never artificial.', excerpt: 'Legacy.', topic: 'EN · ES', language: null, published_iso: '2026-04-18T00:00:00Z' },
  ],
};

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✔ ${label}`); }
  else { fail++; console.log(`  ✘ ${label} ${extra}`); }
};

const BP_FAMILIES = ['Cormorant Garamond', 'Crimson Pro', 'JetBrains Mono', 'Bebas Neue'];
const browser = await chromium.launch();
if (SHOTS) await mkdir(SHOTS, { recursive: true });

async function open(width, { api = 'ok', mobile = width < 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 820 }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.route('**/api/blog-latest*', (route) => {
    if (api === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) });
    if (api === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ posts: [] }) });
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"CHANNEL"}' });
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { ctx, page, errors, external };
}

// ── 1–5 · contenido ──
console.log('\nContenido');
{
  const { ctx, page, errors, external } = await open(1280);
  const hrefs = await page.$$eval('#nav-writing, #drawer a[href="/blog"], #footer-blog', (els) => els.map((e) => e.getAttribute('href')));
  ok(hrefs.length >= 3 && hrefs.every((h) => h === '/blog'), '«Writing» lleva a /blog en cabecera, menú y pie', JSON.stringify(hrefs));
  const cta = await page.$eval('#writing .btn-blog', (e) => ({ href: e.getAttribute('href'), vis: e.getBoundingClientRect().height > 0 }));
  ok(cta.href === '/blog' && cta.vis, 'la sección Writing tiene un botón visible al blog');
  const titles = await page.$$eval('#posts .post-title', (els) => els.map((e) => e.textContent));
  ok(titles.length === 3 && titles[0].startsWith('Pieza nueva'), 'la sección se llena con /api/blog-latest', JSON.stringify(titles));
  ok(await page.evaluate(() => !window.__xss && !document.querySelector('#posts img')), 'un título con HTML se escribe como texto');
  const html = await page.content();
  ok(!/UNREAL(&gt;|>)ILLE/.test(html), 'ninguna forma derogada «UNREAL>ILLE» en la página');
  ok(await page.$('.world-item .lt-logotype .lt-chevron') !== null, 'Worlds muestra >UNREALVILLE studio con su chevron');
  await page.click('#lang-btn');
  const es = await page.$eval('#posts .post-meta span', (e) => e.textContent);
  ok(/oct/i.test(es), 'al cambiar a ES la fecha se reescribe en español', es);
  ok(errors.length === 0, 'cero errores de página', errors.join(' ; '));
  ok(external.length === 0, 'cero peticiones a terceros (fuentes propias)', external.slice(0, 3).join(' '));
  const fams = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  const missing = BP_FAMILIES.filter((f) => !fams.includes(f));
  ok(missing.length === 0, 'las familias cargadas son las del BP', `faltan: ${missing.join(', ')} · cargadas: ${[...new Set(fams)].join(', ')}`);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'home-1280.png'), fullPage: true });
  await ctx.close();
}
for (const api of ['fail', 'empty']) {
  const { ctx, page } = await open(390, { api });
  const n = await page.$$eval('#posts .post', (els) => els.length);
  ok(n >= 1, `con la ruta ${api === 'fail' ? 'en 503' : 'vacía'} queda el respaldo escrito`, `tarjetas: ${n}`);
  await ctx.close();
}

// ── 6 · objetivos táctiles ──
console.log('\nObjetivos táctiles (390 px)');
{
  const { ctx, page } = await open(390);
  const small = await page.evaluate(() => [...document.querySelectorAll('a[href], button, input, textarea')]
    .filter((e) => !e.closest('.drawer,.cf-trap') && !e.classList.contains('skip-link'))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44))
    .map(({ e, r }) => `${e.id || e.className || e.tagName}:${Math.round(r.width)}×${Math.round(r.height)}`));
  ok(small.length === 0, 'todos ≥ 44 px', small.join(' | '));
  await ctx.close();
}

// ── 8 · menú móvil ──
console.log('\nMenú móvil (390 px)');
{
  const { ctx, page } = await open(390);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.click('#menu-btn');
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({
    open: document.getElementById('drawer').classList.contains('open'),
    expanded: document.getElementById('menu-btn').getAttribute('aria-expanded'),
    lock: document.body.style.overflow,
    focusIn: document.getElementById('drawer').contains(document.activeElement),
  }));
  ok(st.open && st.expanded === 'true', 'abre y declara aria-expanded');
  ok(st.lock === 'hidden', 'bloquea el scroll del fondo');
  ok(st.focusIn, 'mueve el foco dentro del panel');
  const big = await page.$$eval('#drawer .drawer-links a', (els) => els.every((e) => e.getBoundingClientRect().height >= 56));
  ok(big, 'enlaces del panel ≥ 56 px');
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'menu-390.png') });
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.getElementById('drawer').contains(document.activeElement) || document.activeElement.id === 'menu-btn'), 'el foco queda atrapado (Tab ×8)');
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => !document.getElementById('drawer').classList.contains('open') && document.body.style.overflow === '');
  ok(closed, 'cierra con Escape y libera el scroll');
  await ctx.close();
}

// ── 9 · anchos ──
console.log('\nAnchos');
for (const w of [360, 390, 768, 1280, 1440]) {
  const { ctx, page, errors } = await open(w);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(errors.length === 0 && over <= 0, `${w} px: sin errores y sin desborde`, `${errors.join(' ; ')} desborde ${over}px`);
  if (SHOTS && w < 900) await page.screenshot({ path: join(SHOTS, `home-${w}.png`), fullPage: true });
  await ctx.close();
}

// ── 10 · formulario de contacto ──
console.log('\nContacto');
for (const [status, label] of [[200, 'enviado'], [503, 'sin configurar'], [502, 'Resend falla']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 820 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let posted = null;
  await page.route('**/api/blog-latest*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) }));
  await page.route('**/api/contact', (r) => { posted = r.request().postDataJSON(); return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { ok: true } : { error: 'x', fallback: 'iam@luciensael.com' }) }); });
  // El respaldo navega a un mailto:; aquí se registra en vez de abrir un cliente de correo.
  await page.addInitScript(() => { window.__mailto = null; document.addEventListener('click', () => {}, true); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.fill('#cf-name', 'Ana');
  await page.fill('#cf-email', 'ana@example.com');
  await page.fill('#cf-msg', 'Hola');
  await page.click('#cf-send');
  await page.waitForTimeout(400);
  const st = await page.$eval('#cf-status', (e) => ({ text: e.textContent, cls: e.className, link: e.querySelector('a')?.getAttribute('href') ?? '' }));
  if (status === 200) ok(posted?.email === 'ana@example.com' && st.cls.includes('ok'), `${label}: confirma en la página`, JSON.stringify(st));
  else ok(st.link.startsWith('mailto:iam@luciensael.com') && st.link.includes('Hola'), `${label}: respaldo al correo de Lucien con el mensaje escrito`, JSON.stringify(st));
  ok(errors.length === 0, `${label}: sin errores de página`, errors.join(' ; '));
  await ctx.close();
}

// ── 11 · el artículo anterior al sistema también usa las fuentes propias ──
console.log('\nArtículo anterior al sistema');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 820 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.goto(url + 'blog/the-intelligence-was-never-artificial.html', { waitUntil: 'networkidle' });
  const fams = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))]);
  ok(external.length === 0, 'cero peticiones a terceros', external.slice(0, 3).join(' '));
  ok(['Cormorant Garamond', 'Crimson Pro'].every((f) => fams.includes(f)), 'Cormorant Garamond y Crimson Pro cargadas', fams.join(', '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n═══ ${pass} pasaron · ${fail} fallaron ═══`);
process.exit(fail ? 1 : 0);
