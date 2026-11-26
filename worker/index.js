// The site's Worker. Static pages are served straight from dist/; only /vm/* runs this code.
// /vm/* is forwarded to the live lab on the server that hosts CardVault, with no password
// (the owner's choice). LAB_UPSTREAM is set in wrangler.jsonc. If a LAB_KEY secret is ever
// added to the Worker, it is sent as X-Lab-Key so the server can require it.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/vm/')) return env.ASSETS.fetch(request);
    if (!env.LAB_UPSTREAM) {
      return Response.json({ error: 'The live lab is not connected yet.' }, { status: 503 });
    }
    const headers = new Headers();
    if (env.LAB_KEY) headers.set('X-Lab-Key', env.LAB_KEY);
    const type = request.headers.get('content-type');
    if (type) headers.set('Content-Type', type);
    let upstream;
    try {
      upstream = await fetch(new URL(url.pathname, env.LAB_UPSTREAM), {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
      });
    } catch {
      return Response.json({ error: 'The live lab did not answer.' }, { status: 502 });
    }
    const out = new Headers(upstream.headers);
    out.delete('www-authenticate');
    out.set('cache-control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
