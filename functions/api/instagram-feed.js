/**
 * Cloudflare Pages Function — /api/instagram-feed
 *
 * Proxy del feed Behold con caching sul CDN Cloudflare. Risolve il problema
 * delle thumbnail Instagram CDN che scadono dopo ~6 giorni: il client riceve
 * sempre URL fresche perché il JSON viene rigenerato dal nostro endpoint
 * almeno ogni 6 ore, e le immagini vengono proxiate via /api/instagram-image
 * (anch'esso cachato).
 *
 * Nessun build step, nessuna GitHub Action, nessun commit periodico.
 */

const BEHOLD_FEED_URL = 'https://feeds.behold.so/b1nAJf39h8WrQslhIhzg';
const N_POSTS = 5;
const PROFILE_URL = 'https://www.instagram.com/_neutralia_/';

const CACHE_SECONDS = 21600;            // 6 ore di cache sul CDN Cloudflare
const STALE_WHILE_REVALIDATE = 86400;   // serve stale fino a 24h mentre rigenera

function captionShort(text, maxLen = 120) {
  if (!text) return '';
  const first = text.trim().split('\n')[0].split('.')[0];
  return first.length > maxLen ? first.slice(0, maxLen).trimEnd() + '…' : first;
}

function fallbackPayload(reason) {
  return {
    _comment: `Fallback feed (${reason}). L'endpoint /api/instagram-feed non è riuscito a contattare Behold.`,
    posts: [
      {
        permalink: PROFILE_URL,
        thumbnailUrl: '',
        mediaType: 'IMAGE',
        captionShort: 'Vedi tutti i post su Instagram',
      },
    ],
  };
}

export async function onRequestGet({ request }) {
  let payload;
  let upstreamStatus = 'ok';

  try {
    const upstream = await fetch(BEHOLD_FEED_URL, {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      headers: { 'User-Agent': 'NeutraliaPagesFn/1.0 (+https://neutralia.info)' },
    });
    if (!upstream.ok) throw new Error(`upstream HTTP ${upstream.status}`);
    const data = await upstream.json();
    const raw = (data.posts || []).slice(0, N_POSTS);

    // Costruisci l'origin per generare URL assolute al proxy immagini
    const origin = new URL(request.url).origin;

    const posts = raw
      .filter(p => (p.thumbnailUrl || p.mediaUrl) && p.permalink)
      .map(p => {
        const thumb = p.thumbnailUrl || p.mediaUrl;
        const proxied = `${origin}/api/instagram-image?u=${encodeURIComponent(thumb)}`;
        return {
          permalink: p.permalink,
          thumbnailUrl: proxied,
          mediaType: p.mediaType || 'IMAGE',
          isReel: Boolean(p.isReel),
          captionShort: captionShort(p.caption),
        };
      });

    // Sesta cella: link al profilo
    posts.push({
      permalink: PROFILE_URL,
      thumbnailUrl: '',
      mediaType: 'IMAGE',
      captionShort: 'Vedi tutti i post',
    });

    payload = {
      _comment: 'Generato in tempo reale da /api/instagram-feed (cache CDN 6h).',
      updatedFrom: raw[0]?.timestamp || '',
      posts,
    };
  } catch (err) {
    upstreamStatus = `error: ${err.message}`;
    payload = fallbackPayload(err.message);
  }

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Cache CDN: 6h fresco, 24h stale-while-revalidate
      'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
      // Il browser rivalida sempre (così appena la CDN ha dati nuovi, l'utente li vede)
      'CDN-Cache-Control': `public, s-maxage=${CACHE_SECONDS}`,
      'X-Upstream-Status': upstreamStatus,
    },
  });
}
