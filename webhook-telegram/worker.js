/**
 * Cloudflare Worker — Neutralia
 *
 * Endpoint POST /prenota-evento
 *   Riceve i dati di prenotazione dal form di neutralia.info/prenota-evento.html
 *   e li salva come contatto in una lista Brevo dedicata all'evento.
 *
 * Webhook Stripe (root)
 *   Riconosciuto e silenziato: risponde 200 OK senza fare nient'altro,
 *   per evitare che Stripe ritenti se un webhook è ancora configurato in
 *   Stripe Dashboard ma non vogliamo notifiche.
 *
 * VARIABILI D'AMBIENTE (Cloudflare → Worker → Settings → Variables and Secrets):
 *   BREVO_API_KEY        — chiave API Brevo (xkeysib-...) — TYPE: Secret
 *   BREVO_EVENT_LIST_ID  — ID numerico della lista Brevo 'Evento 19 giugno' — TYPE: Text
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      return new Response(
        'Neutralia worker OK — POST /prenota-evento per le prenotazioni evento.',
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

    // === Altri POST (es. webhook Stripe ancora attivo): rispondiamo 200 silenziosi ===
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
