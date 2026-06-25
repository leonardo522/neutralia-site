/**
 * Cloudflare Worker — Neutralia
 *
 * Endpoint POST /prenota-evento
 *   Riceve i dati di prenotazione dal form di neutralia.info e li salva come
 *   contatto in una lista Brevo dedicata all'evento.
 *
 * Endpoint POST /stripe-webhook
 *   Riceve eventi Stripe per processarli:
 *   - checkout.session.completed (mode=subscription) → aggiunge l'email
 *     del sostenitore alla lista Brevo "Sostenitori Osservatori" (id 10).
 *   - checkout.session.completed (mode=payment, libro/donazione) → notifica
 *     Telegram (se BOT_TOKEN configurato).
 *
 * Webhook Stripe (root)
 *   Riconosciuto e silenziato: risponde 200 OK per evitare retry da Stripe.
 *
 * VARIABILI D'AMBIENTE (Cloudflare → Worker → Settings → Variables and Secrets):
 *   BREVO_API_KEY                  — chiave API Brevo (xkeysib-...) — Secret
 *   BREVO_EVENT_LIST_ID            — ID numerico lista 'Evento 19 giugno' — Text
 *   BREVO_SUBSCRIBERS_LIST_ID      — ID numerico lista 'Sostenitori Osservatori' (10) — Text
 *   STRIPE_WEBHOOK_SECRET          — signing secret del webhook Stripe — Secret
 *   TELEGRAM_BOT_TOKEN             — (opzionale) token bot Telegram per notifiche acquisto — Secret
 *   TELEGRAM_CHAT_ID               — (opzionale) chat id per notifiche — Text
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      return new Response(
        'Neutralia worker OK — POST /prenota-evento o /stripe-webhook',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // === Endpoint prenotazione evento → Brevo ===
    if (url.pathname === '/prenota-evento') {
      return handlePrenotazione(request, env);
    }

    // === Webhook Stripe → Brevo sostenitori + (opz.) Telegram ===
    if (url.pathname === '/stripe-webhook' || url.pathname === '/') {
      return handleStripeWebhook(request, env);
    }

    return new Response('OK', { status: 200 });
  },
};

// ---------- CORS ----------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// ---------- Prenotazione → Brevo ----------
async function handlePrenotazione(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders() });
  }

  const nome = String(data.nome || '').trim();
  const cognome = String(data.cognome || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const partecipanti = parseInt(data.partecipanti, 10) || 1;
  const note = String(data.note || '').trim();

  if (!nome || !cognome || !email) {
    return new Response('Campi obbligatori mancanti', { status: 400, headers: corsHeaders() });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Email non valida', { status: 400, headers: corsHeaders() });
  }

  try {
    await saveToBrevo({
      apiKey: env.BREVO_API_KEY,
      listId: parseInt(env.BREVO_EVENT_LIST_ID, 10),
      email,
      attributes: {
        NOME: nome,
        COGNOME: cognome,
        PARTECIPANTI: partecipanti,
        NOTE: note || '',
        DATA_PRENOTAZIONE: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Brevo save failed (prenota):', e.message);
    return new Response('Errore salvataggio prenotazione', { status: 500, headers: corsHeaders() });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

// ---------- Stripe Webhook → Brevo sostenitori + Telegram ----------
async function handleStripeWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  // Verifica firma se WEBHOOK_SECRET impostato
  if (env.STRIPE_WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.error('Stripe webhook: invalid signature');
      return new Response('Invalid signature', { status: 400 });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Solo checkout.session.completed ci interessa
  if (event.type !== 'checkout.session.completed') {
    return new Response('OK (ignored)', { status: 200 });
  }

  const session = event.data.object;
  const mode = session.mode; // 'payment' | 'subscription' | 'setup'
  const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
  const name = session.customer_details?.name || '';

  // === SUBSCRIPTION → Brevo Sostenitori Osservatori ===
  if (mode === 'subscription' && email && env.BREVO_API_KEY && env.BREVO_SUBSCRIBERS_LIST_ID) {
    try {
      const [nome, ...cognomeParts] = name.split(' ');
      await saveToBrevo({
        apiKey: env.BREVO_API_KEY,
        listId: parseInt(env.BREVO_SUBSCRIBERS_LIST_ID, 10),
        email,
        attributes: {
          NOME: nome || '',
          COGNOME: cognomeParts.join(' ') || '',
          STRIPE_CUSTOMER_ID: session.customer || '',
          SUBSCRIPTION_ID: session.subscription || '',
          DATA_ISCRIZIONE: new Date().toISOString(),
          IMPORTO_MENSILE_EUR: (session.amount_total || 0) / 100,
        },
      });
      console.log(`✓ Sostenitore aggiunto a Brevo: ${email}`);
    } catch (e) {
      console.error('Brevo save failed (subscription):', e.message);
    }
  }

  // === PAYMENT (libro/donazione one-time) → Telegram ===
  if (mode === 'payment' && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const amount = (session.amount_total || 0) / 100;
      const currency = (session.currency || 'eur').toUpperCase();
      const addr = session.customer_details?.address;
      const addrLine = addr
        ? `${addr.line1 || ''}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
        : 'n/d';
      const msg = [
        '📚 *Nuovo ordine Neutralia*',
        '',
        `💶 *${amount.toFixed(2)} ${currency}*`,
        '',
        `👤 ${name || 'n/d'}`,
        `📧 ${email || 'n/d'}`,
        `📍 ${addrLine}`,
        '',
        `🆔 \`${session.id}\``,
      ].join('\n');
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: msg,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) {
      console.error('Telegram notification failed:', e.message);
    }
  }

  return new Response('OK', { status: 200 });
}

// ---------- Verifica firma Stripe webhook (HMAC SHA-256) ----------
async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(s => s.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  // Reject signatures older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(t, 10);
  if (Math.abs(age) > 300) return false;
  const payload = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // Costante: confronto a tempo costante
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

async function saveToBrevo({ apiKey, listId, email, attributes }) {
  if (!apiKey || !listId) throw new Error('Brevo env vars mancanti');
  const r = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      email,
      attributes,
      listIds: [listId],
      updateEnabled: true,
    }),
  });
  if (!r.ok && r.status !== 204) {
    const t = await r.text();
    throw new Error(`Brevo API ${r.status}: ${t}`);
  }
}
