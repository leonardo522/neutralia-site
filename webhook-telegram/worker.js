/**
 * Cloudflare Worker — Webhook Stripe → Notifica Telegram
 *
 * Riceve i webhook di Stripe e quando arriva un evento
 * `checkout.session.completed` invia un messaggio formattato
 * al bot Telegram configurato.
 *
 * Configurato per il Libro Neutralia (€15), ma generico:
 * funziona per qualsiasi prodotto Stripe.
 *
 * VARIABILI D'AMBIENTE (da impostare nel dashboard Cloudflare):
 *   TELEGRAM_BOT_TOKEN     — token del bot ottenuto da @BotFather
 *   TELEGRAM_CHAT_ID       — ID della chat a cui mandare i messaggi
 *   STRIPE_WEBHOOK_SECRET  — signing secret del webhook Stripe (whsec_...)
 *
 * URL Worker (dopo deploy):
 *   https://<nome-worker>.<sottodominio>.workers.dev
 * Questo URL va inserito in Stripe Dashboard → Developers → Webhooks.
 */

export default {
  async fetch(request, env) {
    // Healthcheck per test manuali
    if (request.method === 'GET') {
      return new Response('Neutralia webhook OK — invia POST con firma Stripe.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 1. Verifica firma Stripe
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();
    const valid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      return new Response('Invalid signature', { status: 400 });
    }

    // 2. Parsa evento
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // 3. Ignora eventi che non interessano (es. payment_intent.created, ecc.)
    if (event.type !== 'checkout.session.completed') {
      return new Response(`Ignored event: ${event.type}`, { status: 200 });
    }

    // 4. Estrai i dati dell'acquisto
    const s = event.data.object;
    const amount = (s.amount_total / 100).toFixed(2);
    const currency = (s.currency || 'eur').toUpperCase();
    const c = s.customer_details || {};
    const a = c.address || {};
    const addrLine = [a.line1, a.line2, a.postal_code, a.city, a.state, a.country]
      .filter(Boolean).join(', ') || '(nessun indirizzo)';

    // Tag dal Stripe Checkout (puoi aggiungere ?client_reference_id=foo o metadata custom)
    const productLabel = s.metadata?.product_name
      || (amount === '15.00' ? 'Libro Neutralia (cartaceo €15)' : `Ordine €${amount}`);

    // 5. Componi messaggio Telegram (HTML mode per evitare escape Markdown)
    const msg =
      `📚 <b>Nuovo ordine Neutralia</b>\n\n` +
      `<b>${esc(productLabel)}</b>\n` +
      `💶 <b>${amount} ${currency}</b>\n\n` +
      `👤 ${esc(c.name || '(nessun nome)')}\n` +
      `📧 ${esc(c.email || '(nessuna email)')}\n` +
      `📞 ${esc(c.phone || '(nessun telefono)')}\n` +
      `📍 ${esc(addrLine)}\n\n` +
      `🆔 <code>${esc(s.id)}</code>\n` +
      `🕒 ${new Date((s.created || Date.now() / 1000) * 1000).toLocaleString('it-IT')}`;

    // 6. Invia su Telegram
    try {
      await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg);
    } catch (e) {
      console.error('Telegram send failed:', e.message);
      // Restituiamo 200 anche se Telegram fallisce, così Stripe non rinvia
      // a ciclo infinito (lo logghiamo solo).
    }

    return new Response('OK', { status: 200 });
  },
};

// ---------- Telegram ----------

async function sendTelegram(token, chatId, text) {
  if (!token || !chatId) throw new Error('Telegram env vars mancanti');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Telegram API ${r.status}: ${t}`);
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------- Verifica firma Stripe (HMAC-SHA256) ----------

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  // Header: t=1234567890,v1=abcdef..,v0=...
  const parts = Object.fromEntries(
    sigHeader.split(',').map(p => {
      const idx = p.indexOf('=');
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // Tolleranza temporale 5 minuti (evita replay attack)
  const age = Math.abs(Date.now() / 1000 - parseInt(t, 10));
  if (age > 300) return false;

  const expected = await hmacSha256(secret, `${t}.${payload}`);
  return constantTimeEqual(expected, v1);
}

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
