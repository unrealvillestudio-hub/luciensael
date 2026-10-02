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

const OK = { name: 'Ana Pérez', email: 'ana@example.com', message: 'First line\nSecond line' };

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

console.log(`\n═══ ${pass} pasaron · ${fail} fallaron ═══`);
process.exit(fail ? 1 : 0);
