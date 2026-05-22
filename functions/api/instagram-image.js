/**
 * Cloudflare Pages Function — /api/instagram-image?u=<encoded Instagram CDN URL>
 *
 * Proxy delle thumbnail Instagram. La URL viene cachata aggressivamente sul
 * CDN Cloudflare (30 giorni). Quando l'URL Instagram CDN scade (~6 giorni),
 * il primo client che richiede la cache miss fa ricaricare l'immagine: se
 * Instagram restituisce 403/404 (URL signed expired), restituiamo una
 * placeholder trasparente. Il JSON aggiornato (con URL fresche) arriva
 * comunque entro 6 ore dall'altro endpoint.
 *
 * Restrizione: accettiamo solo URL di host noti Instagram per evitare
 * di trasformare il sito in un open proxy.
 */

const ALLOWED_HOSTS = [
  'scontent.cdninstagram.com',
  'cdninstagram.com',
  'fbcdn.net',
  'behold.pictures',
];

const CACHE_SECONDS = 60 * 60 * 24 * 30;  // 30 giorni
const TRANSPARENT_PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

function isAllowed(host) {
  return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
}

function placeholderResponse() {
  return new Response(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get('u');
  if (!target) return new Response('missing u param', { status: 400 });

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('invalid url', { status: 400 });
  }
  if (parsed.protocol !== 'https:' || !isAllowed(parsed.hostname)) {
    return new Response('host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
      },
    });

    if (!upstream.ok) return placeholderResponse();

    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
        'CDN-Cache-Control': `public, s-maxage=${CACHE_SECONDS}`,
      },
    });
  } catch {
    return placeholderResponse();
  }
}
