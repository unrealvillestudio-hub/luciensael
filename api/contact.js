// api/contact.js — el formulario de Contact de la portada, a iam@luciensael.com.
//
// POR QUÉ EXISTE. El formulario estaba declarado con `onsubmit="return false"`: quien lo
// llenaba no enviaba nada y no se enteraba. Decisión de Sam (2026-10-02): a iam@luciensael.com.
//
// Patrón de `forumphs-com/api/contact.js`: Resend desde la función del sitio, todo lo que
// escribe el visitante ESCAPADO, correo validado antes de usarlo en `reply_to`, asunto sin
// saltos de línea y campos acotados.
//
// CONFIGURACIÓN (proyecto `luciensael` en Vercel, nunca en el repo):
//   RESEND_API_KEY  → clave de la cuenta de Resend donde está verificado el dominio remitente.
//   CONTACT_FROM    → remitente, opcional. Por defecto «Lucien Sael <noreply@luciensael.com>»;
//                     el dominio tiene que estar verificado en esa cuenta.
// Sin RESEND_API_KEY la ruta responde 503 y NO se pierde el mensaje: la portada abre el correo
// del visitante con el mensaje ya escrito para iam@luciensael.com.
//
// RESPUESTA. Con `Accept: application/json` (el formulario con JS) devuelve JSON. Sin JS, el
// navegador hace un POST normal y recibe una redirección 303 a la portada con el resultado.

import { escapeHtml } from './_render.js';

const TO = 'iam@luciensael.com';
const DEFAULT_FROM = 'Lucien Sael <noreply@luciensael.com>';

// Topes por campo: una primera conversación no necesita más, y el tope evita que la ruta
// reenvíe cuerpos arbitrarios.
const MAX_LEN = { name: 200, email: 254, message: 5000, website: 200 };

// ── Defensa contra bots (2026-11-17, Sam: «hay unos bots entrando por la web de LucienSael») ──
// Patrón de `forumphs-com/api/contact.js` (2026-11-13). Dos capas:
//
// 1 · DESCARTE SILENCIOSO — el bot torpe. El campo trampa `website` (ya existía) y el tiempo entre
//     la carga de la página y el envío, que mide el NAVEGADOR (`form_ms`, milisegundos) para no
//     depender de su reloj. Nadie escribe nombre, correo y mensaje en menos de tres segundos. El bot
//     recibe la misma confirmación que una persona: si se le dijera que falló, aprendería qué cambiar.
//     Sin JavaScript `form_ms` no llega y el envío NO se descarta por eso.
//
// 2 · MARCA DE SOSPECHA — el bot que esquiva la capa 1 (envía sin JavaScript). La consulta NO se
//     descarta: llega igual a iam@luciensael.com, marcada en el asunto y con sus señales, para que
//     una persona real con un formulario raro nunca se pierda.
export const ELAPSED_FIELD = 'form_ms';
const MIN_FILL_MS = 3_000;
const MAX_FILL_MS = 24 * 60 * 60 * 1000;

// El motivo por el que el envío es de un bot sin duda, o `null`.
export function botReason(body) {
  const trap = body?.website;
  if (trap != null && String(trap).trim() !== '') return 'HONEYPOT';
  const raw = body?.[ELAPSED_FIELD];
  if (raw == null || String(raw).trim() === '') return null;
  const text = String(raw).trim();
  if (!/^\d{1,12}$/.test(text)) return 'BAD_TIMER';   // la portada sólo escribe enteros
  const ms = Number(text);
  if (ms < MIN_FILL_MS) return 'TOO_FAST';
  if (ms > MAX_FILL_MS) return 'STALE_FORM';
  return null;
}

export const SUSPECT_SUBJECT_MARK = '(posible bot)';
const OWN_DOMAIN = 'luciensael.com';

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Una palabra de 10 letras o más con 5 consonantes seguidas no existe en inglés ni en español
// corriente. Es el rastro de un teclado aporreado.
const MASHED_WORD_RE = /[bcdfghjklmnpqrstvwxyz]{5}/;
function looksMashed(text) {
  return normalize(text).split(/[^a-zñ]+/).some((w) => w.length >= 10 && MASHED_WORD_RE.test(w));
}

const LINK_RE = /(https?:\/\/|www\.)/i;

// Señales (códigos estables) de que la consulta parece de un bot. Vacía = parece de una persona.
export function suspectReasons(fields, body) {
  const reasons = [];
  const raw = body?.[ELAPSED_FIELD];
  if (raw == null || String(raw).trim() === '') reasons.push('SIN_TIEMPO');
  if (fields.message && normalize(fields.message) === normalize(fields.name)) reasons.push('MENSAJE_IGUAL_A_NOMBRE');
  if (looksMashed(fields.message) || looksMashed(fields.name)) reasons.push('TEXTO_SIN_SENTIDO');
  if (LINK_RE.test(fields.message) || LINK_RE.test(fields.name)) reasons.push('ENLACE');
  // Quien escribe para hablar de un proyecto no suele citar nuestra dirección web; quien vende algo sí.
  if (normalize(fields.message).includes(OWN_DOMAIN)) reasons.push('NOMBRA_NUESTRO_DOMINIO');
  return reasons;
}

// Forma, no existencia: una arroba, algo a cada lado, un punto en el dominio y nada que rompa
// un `mailto:` o una cabecera.
const EMAIL_RE = /^[^\s@<>"'()\\,;:]+@[^\s@<>"'()\\,;:]+\.[^\s@<>"'()\\,;:]+$/;

function field(body, name) {
  const raw = body?.[name];
  const value = typeof raw === 'string' ? raw : (raw == null ? '' : String(raw));
  return value.trim().slice(0, MAX_LEN[name]);
}

function wantsJson(req) {
  return String(req.headers?.accept ?? '').includes('application/json');
}

function reply(req, res, status, payload) {
  if (wantsJson(req)) return res.status(status).json(payload);
  // Sin JS: vuelve a la sección de contacto con el resultado en la URL.
  const flag = status < 300 ? 'sent=1' : `error=${encodeURIComponent(payload.error ?? 'error')}`;
  return res.redirect(303, `/?${flag}#contact`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};

  // Bot sin duda (campo trampa o tiempo imposible): se responde como si se hubiera enviado y no
  // se envía nada.
  const bot = botReason(body);
  if (bot) {
    console.error(`[contact] CONTACT_BOT_DISCARDED ${bot}`);
    return reply(req, res, 200, { ok: true });
  }

  const name = field(body, 'name');
  const email = field(body, 'email');
  const message = field(body, 'message');

  if (!name || !email || !message) return reply(req, res, 400, { error: 'missing_fields' });
  if (!EMAIL_RE.test(email)) return reply(req, res, 400, { error: 'invalid_email' });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('[contact] RESEND_API_KEY no está configurada en el proyecto de Vercel');
    return reply(req, res, 503, { error: 'not_configured', fallback: TO });
  }

  // El asunto es una cabecera: sin saltos de línea aunque el nombre los traiga.
  const subjectName = name.replace(/[\r\n]+/g, ' ');
  const safe = (v) => escapeHtml(v);

  const suspect = suspectReasons({ name, email, message }, body);
  if (suspect.length) console.error(`[contact] CONTACT_SUSPECT ${suspect.join(',')}`);
  const suspectBanner = suspect.length
    ? `<p style="margin:0 0 16px;padding:10px 12px;background:#FFF4E5;border-left:3px solid #B54708;font-family:monospace;font-size:12px;color:#7A2E0E">`
      + `<strong>Posible bot</strong>. Señales: ${safe(suspect.join(', '))}.</p>`
    : '';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || DEFAULT_FROM,
        to: [TO],
        reply_to: email,
        subject: suspect.length
          ? `luciensael.com ${SUSPECT_SUBJECT_MARK} — ${subjectName}`
          : `luciensael.com — ${subjectName}`,
        // Todo lo que escribe el visitante entra ESCAPADO: el correo no transporta HTML,
        // enlaces ni imágenes de terceros.
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1C1C1A">
            <p style="font-family:monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#D4622A;margin:0 0 16px">luciensael.com · Contact</p>
            ${suspectBanner}
            <table style="width:100%;border-collapse:collapse;font-size:15px">
              <tr><td style="padding:6px 0;color:#4A4A45;width:90px">Name</td><td style="padding:6px 0;font-weight:600">${safe(name)}</td></tr>
              <tr><td style="padding:6px 0;color:#4A4A45">Email</td><td style="padding:6px 0"><a href="mailto:${safe(email)}">${safe(email)}</a></td></tr>
            </table>
            <div style="margin-top:18px;padding:16px;background:#F4F1EB;border-left:3px solid #D4622A;font-size:15px;line-height:1.6">
              ${safe(message).replace(/\r?\n/g, '<br>')}
            </div>
          </div>`,
      }),
    });
    if (response.ok) return reply(req, res, 200, { ok: true });
    const err = await response.json().catch(() => ({}));
    console.error('[contact] Resend:', response.status, JSON.stringify(err).slice(0, 300));
    return reply(req, res, 502, { error: 'send_failed', fallback: TO });
  } catch (e) {
    console.error('[contact] error:', e?.message ?? e);
    return reply(req, res, 502, { error: 'send_failed', fallback: TO });
  }
}
