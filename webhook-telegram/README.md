# Webhook Stripe → Telegram per Neutralia

Quando qualcuno compra il libro cartaceo Neutralia (€15) su Stripe Checkout,
ricevi una notifica su Telegram entro pochi secondi.

Stack: **Cloudflare Worker** (gratis, ~30s di lavoro al deploy). Funziona
indipendentemente dall'hosting del sito.

---

## Setup in 4 passi

### 1. Crea il bot Telegram (2 min)

1. Apri Telegram, cerca **@BotFather**, avvia chat
2. Manda `/newbot`
3. Scegli un nome (es. `Neutralia Notifiche`) e uno username (es. `neutralia_notify_bot`)
4. BotFather ti dà un **token** tipo `1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ`
5. **Copia il token** — è la tua chiave d'accesso

### 2. Trova il tuo chat_id (1 min)

1. Cerca il bot che hai appena creato su Telegram, **avvia chat e mandagli un messaggio qualsiasi** (es. "ciao")
2. Apri nel browser:
   ```
   https://api.telegram.org/bot<IL_TUO_TOKEN>/getUpdates
   ```
3. Cerca nel JSON `"chat":{"id":NUMERO,...}` → quel numero è il tuo **chat_id**
4. **Copialo**

> Se preferisci ricevere le notifiche in un canale o gruppo, aggiungi il bot
> al canale/gruppo come admin, manda un messaggio, e usa il chat_id che
> trovi (per i canali è negativo, es. `-1001234567890`).

### 3. Deploya il Worker (5 min)

1. Vai su https://dash.cloudflare.com/ → **Workers & Pages**
2. **Create application** → **Create Worker** → dai un nome (es. `neutralia-stripe-webhook`)
3. Click **Deploy** (deploya il "hello world" placeholder, lo sostituisci ora)
4. Click **Edit code**
5. **Cancella tutto** il contenuto del file e **incolla il contenuto di [worker.js](worker.js)** (puoi copiarlo da GitHub o aprire il file in locale)
6. Click **Save and Deploy**
7. In alto trovi l'URL pubblico del Worker, tipo:
   ```
   https://neutralia-stripe-webhook.<tuoaccount>.workers.dev
   ```
   **Copialo**, ti serve al passo 4.

Ora configura le variabili d'ambiente:

8. Sempre nel Worker → **Settings** → **Variables** → **Add variable** (3 volte):
   - `TELEGRAM_BOT_TOKEN` = il token di BotFather (passo 1) — usa "Encrypt" perché è un segreto
   - `TELEGRAM_CHAT_ID` = il tuo chat_id (passo 2)
   - `STRIPE_WEBHOOK_SECRET` = lo otterrai al passo 4 (puoi metterlo dopo, oppure mettere un placeholder)
9. Click **Save and deploy** dopo ogni variabile

### 4. Configura il webhook in Stripe (3 min)

1. Vai su https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. **Endpoint URL** = l'URL del Worker dal passo 3 (es. `https://neutralia-stripe-webhook.tuoaccount.workers.dev`)
4. **Listen to** → **Events on your account**
5. **Select events** → cerca e spunta **`checkout.session.completed`** → "Add events"
6. Click **Add endpoint**
7. Nella pagina del webhook appena creato, cerca **Signing secret** → click **Reveal** → copia il valore (`whsec_xxxx`)
8. Torna nel Worker Cloudflare → Settings → Variables → modifica `STRIPE_WEBHOOK_SECRET` con questo valore → Save and deploy

### Test

In Stripe Dashboard → Webhooks → il tuo endpoint → click sui 3 puntini → **Send test webhook** → seleziona `checkout.session.completed` → Send.

Entro qualche secondo dovresti ricevere su Telegram:

> 📚 **Nuovo ordine Neutralia**
>
> **Libro Neutralia (cartaceo €15)**
> 💶 **15.00 EUR**
>
> 👤 Jenny Rosen
> 📧 jenny@example.com
> 📍 1234 Main Street, San Francisco, CA, US
>
> 🆔 `cs_test_a1b2c3...`
> 🕒 22/05/2026, 21:34:12

Se non arriva nulla:
- **Recent deliveries** in Stripe Dashboard → verifica response 200 OK
- Se vedi 400 "Invalid signature" → ricontrolla `STRIPE_WEBHOOK_SECRET` nel Worker
- **Cloudflare → Worker → Logs** (Real-time logs) → vedi se arriva la richiesta e l'eventuale errore

---

## Sviluppi futuri possibili (a richiesta)

- Notifica anche per **donazioni** PayPal/Stripe (filtri sui prodotti via metadata)
- **Riassunto giornaliero** ordini (Cron Trigger Worker)
- Notifica solo se importo > X €
- Logging in Cloudflare D1 / KV (storico ordini)
