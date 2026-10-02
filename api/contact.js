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

  // Trampa para robots: el campo `website` está oculto para las personas. Si llega lleno se
  // responde como si se hubiera enviado y no se envía nada.
  if (field(body, 'website')) return reply(req, res, 200, { ok: true });

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

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || DEFAULT_FROM,
        to: [TO],
        reply_to: email,
        subject: `luciensael.com — ${subjectName}`,
        // Todo lo que escribe el visitante entra ESCAPADO: el correo no transporta HTML,
        // enlaces ni imágenes de terceros.
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1C1C1A">
            <p style="font-family:monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#D4622A;margin:0 0 16px">luciensael.com · Contact</p>
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
