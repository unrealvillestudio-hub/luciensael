// Verificación de api/contact.js. No envía correo: simula Resend interceptando `fetch`.
// Patrón de forumphs-com/scripts/verify-contact.mjs.
//
// CÓMO SE CORRE:  node scripts/verify-contact.mjs
// Para inyectarle una regresión:  CONTACT_MODULE=/ruta/a/contact.js node scripts/verify-contact.mjs

import { pathToFileURL } from 'node:url';

const modulePath = process.env.CONTACT_MODULE
  ? pathToFileURL(process.env.CONTACT_MODULE).href
  : new URL('../api/contact.js', import.meta.url).href;
const handler = (await import(modulePath)).default;

let sent = [];
let resendOk = true;
globalThis.fetch = async (url, init) => {
  sent.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers?.Authorization });
  return resendOk
    ? { ok: true, status: 200, json: async () => ({ id: 'simulado' }) }
    : { ok: false, status: 422, json: async () => ({ message: 'fallo simulado' }) };
};
console.error = () => {};

function mockRes() {
  const r = { statusCode: 200, location: null, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.redirect = (c, l) => { r.statusCode = c; r.location = l; return r; };
  return r;
}
async function post(body, { method = 'POST', json = true } = {}) {
  sent = [];
  const res = mockRes();
  await handler({ method, body, headers: json ? { accept: 'application/json' } : { accept: 'text/html' } }, res);
  return { res, mail: sent[0]?.body ?? null, call: sent[0] ?? null };
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name} ${extra}`); }
}

const OK = { name: 'Ana Pérez', email: 'ana@example.com', message: 'First line\nSecond line', form_ms: '45000' };

console.log('\n── 1 · Sin clave de Resend: 503 y el respaldo es el correo de Lucien ──');
delete process.env.RESEND_API_KEY;
let { res, mail } = await post(OK);
check('503 not_configured, sin envío', res.statusCode === 503 && res.body?.error === 'not_configured' && mail === null, res.statusCode);
check('el respaldo declara iam@luciensael.com', res.body?.fallback === 'iam@luciensael.com');

process.env.RESEND_API_KEY = 'valor-simulado-no-es-un-secreto';
delete process.env.CONTACT_FROM;

console.log('\n── 2 · Envío válido ──');
({ res, mail } = await post(OK));
check('200 { ok: true } con JS', res.statusCode === 200 && res.body?.ok === true, res.statusCode);
check('a iam@luciensael.com y a nadie más', JSON.stringify(mail?.to) === '["iam@luciensael.com"]', JSON.stringify(mail?.to));
check('reply_to es el correo del visitante', mail?.reply_to === 'ana@example.com');
check('remitente por defecto del dominio de Lucien', mail?.from === 'Lucien Sael <noreply@luciensael.com>', mail?.from);
check('el salto de línea del mensaje se muestra como <br>', mail?.html.includes('First line<br>Second line'));
process.env.CONTACT_FROM = 'Lucien Sael <noreply@example.org>';
({ mail } = await post(OK));
check('CONTACT_FROM manda sobre el remitente por defecto', mail?.from === 'Lucien Sael <noreply@example.org>');
delete process.env.CONTACT_FROM;
({ res } = await post(OK, { json: false }));
check('sin JS: 303 a /?sent=1#contact', res.statusCode === 303 && res.location === '/?sent=1#contact', `${res.statusCode} ${res.location}`);

console.log('\n── 3 · Lo que escribe el visitante llega ESCAPADO ──');
({ mail } = await post({ name: '<img src=x onerror=alert(1)>', email: 'ana@example.com', message: '<a href="https://phishing.example">clic</a>' }));
const html = mail?.html ?? '';
check('nombre: la etiqueta no llega viva', !html.includes('<img src=x') && html.includes('&lt;img src=x onerror=alert(1)&gt;'));
check('mensaje: el enlace no llega vivo', !html.includes('<a href="https://phishing.example"'));

console.log('\n── 4 · Validación: 400 y no se envía nada ──');
for (const bad of ['sin-arroba', 'a@b', 'x" onmouseover="alert(1)@e.com', 'ana@example.com\nBcc: otro@example.com']) {
  ({ res, mail } = await post({ ...OK, email: bad }));
  check(`«${bad.replace(/\n/g, '\\n')}» → 400 sin envío`, res.statusCode === 400 && mail === null, res.statusCode);
}
({ res, mail } = await post({ ...OK, message: '   ' }));
check('mensaje vacío → 400 sin envío', res.statusCode === 400 && mail === null);
({ res } = await post(OK, { method: 'GET' }));
check('GET → 405', res.statusCode === 405);
({ mail } = await post({ ...OK, name: 'Ana\r\nBcc: otro@example.com' }));
check('el asunto no transporta saltos de línea', mail && !/[\r\n]/.test(mail.subject), JSON.stringify(mail?.subject));
({ mail } = await post({ ...OK, message: 'x'.repeat(20000) }));
check('mensaje acotado a 5000', mail && (mail.html.match(/x+/g) || []).reduce((m, s) => Math.max(m, s.length), 0) <= 5000);

console.log('\n── 5 · Trampa para robots ──');
({ res, mail } = await post({ ...OK, website: 'https://spam.example' }));
check('con el campo oculto lleno: 200 y NO se envía', res.statusCode === 200 && mail === null);

console.log('\n── 6 · Fallo de Resend ──');
resendOk = false;
({ res } = await post(OK));
check('Resend falla → 502 con respaldo', res.statusCode === 502 && res.body?.fallback === 'iam@luciensael.com', res.statusCode);
resendOk = true;

console.log('\n── 7 · Bots: descarte silencioso por tiempo ──');
for (const [ms, why] of [['900', 'TOO_FAST'], ['12abc', 'BAD_TIMER'], [String(25 * 3600 * 1000), 'STALE_FORM']]) {
  ({ res, mail } = await post({ ...OK, form_ms: ms }));
  check(`form_ms=${ms} (${why}) → 200 y NO se envía`, res.statusCode === 200 && res.body?.ok === true && mail === null, res.statusCode);
}
({ res, mail } = await post({ ...OK, form_ms: '3000' }));
check('form_ms en el umbral (3000) se envía', res.statusCode === 200 && mail !== null);

console.log('\n── 8 · Bots: marca de sospecha (llega, marcado) ──');
({ mail } = await post(OK));
check('persona: asunto sin marca y sin aviso', mail && !mail.subject.includes('(posible bot)') && !mail.html.includes('Posible bot'), mail?.subject);
const { form_ms: _omit, ...SIN_JS } = OK;
({ res, mail } = await post(SIN_JS, { json: false }));
check('sin form_ms: se envía igual (303 a ?sent=1)', res.statusCode === 303 && res.location === '/?sent=1#contact' && mail !== null);
check('sin form_ms: asunto marcado', mail?.subject === 'luciensael.com (posible bot) — Ana Pérez', mail?.subject);
check('sin form_ms: aviso con SIN_TIEMPO', mail?.html.includes('Posible bot') && mail?.html.includes('SIN_TIEMPO'));
const casos = [
  [{ message: 'Ana Pérez' }, 'MENSAJE_IGUAL_A_NOMBRE'],
  [{ message: 'Hello, xkcdfgrtplmnoqw is ready' }, 'TEXTO_SIN_SENTIDO'],
  [{ message: 'See https://seo.example now' }, 'ENLACE'],
  [{ message: 'Visit www.seo.example' }, 'ENLACE'],
  [{ message: 'I reviewed LucienSael.com and can rank it #1 on Google' }, 'NOMBRA_NUESTRO_DOMINIO'],
];
for (const [cambio, codigo] of casos) {
  ({ mail } = await post({ ...OK, ...cambio }));
  check(`${codigo}: llega marcado`, mail && mail.subject.includes('(posible bot)') && mail.html.includes(codigo), mail?.subject);
}
({ mail } = await post({ ...OK, message: 'I am building a world and would love to talk about narrative design.' }));
check('mensaje normal en inglés: sin marca', mail && !mail.subject.includes('(posible bot)'));
({ mail } = await post({ ...OK, message: 'Estoy construyendo una plataforma de investigación cinematográfica.' }));
check('mensaje normal en español: sin marca', mail && !mail.subject.includes('(posible bot)'));
({ mail } = await post({ ...OK, name: '<b>x</b>', message: 'https://x.example' }));
check('el aviso no deja pasar HTML del visitante', mail && !mail.html.includes('<b>x</b>'));

console.log(`\n═══ ${pass} pasaron · ${fail} fallaron ═══`);
process.exit(fail ? 1 : 0);
