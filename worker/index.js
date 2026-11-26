// The site's Worker. Static pages are served straight from dist/; only /vm/* runs this code.
// /vm/* is forwarded to the live lab on the server that hosts CardVault. The lab's own
// proxy checks the password the page sends, so this Worker holds no password itself.
// LAB_UPSTREAM (the lab's address) is set in wrangler.jsonc.

const FORWARD_HEADERS = ['authorization', 'content-type', 'accept'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/vm/')) return env.ASSETS.fetch(request);
    if (!env.LAB_UPSTREAM) {
      return Response.json({ error: 'The live lab is not connected yet.' }, { status: 503 });
    }
    const headers = new Headers();
    for (const name of FORWARD_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
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
    // The page shows its own password form, so stop the browser's built-in prompt.
    out.delete('www-authenticate');
    out.set('cache-control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
