// The site's Worker. Static pages are served straight from dist/; only /vm/* runs this code.
// /vm/* is forwarded to the live lab on the server that hosts CardVault. The page never asks
// for a password (the owner's requirement): the Worker signs in for it. LAB_UPSTREAM is set in
// wrangler.jsonc; LAB_AUTH ("user:password" for the lab's Caddy site) is a Worker secret set in
// the Cloudflare dashboard, so it is never in this repository or in the page.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/vm/')) return env.ASSETS.fetch(request);
    if (!env.LAB_UPSTREAM) {
      return Response.json({ error: 'The live lab is not connected yet.' }, { status: 503 });
    }
    const headers = new Headers();
    if (env.LAB_AUTH) headers.set('Authorization', `Basic ${btoa(env.LAB_AUTH)}`);
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
