// The https redirect registered with Epic. See bounce.ts for why it exists.
// Public by necessity: the hospital's login page sends her browser here with
// no Ciatta session, so platform JWT verification is off for this function
// (supabase/config.toml). It reads nothing and writes nothing.

import { appTarget } from './bounce.ts';

Deno.serve((req: Request) => {
  const target = appTarget(req.url);
  // A redirect for the app's browser session, which closes on the ciatta
  // scheme, and a link for the rare browser that will not follow one.
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font-family:system-ui;padding:24px">Returning to Ciatta. <a href="${target.replace(/"/g, '&quot;')}">Continue</a></p>`,
    {
      status: 302,
      headers: { Location: target, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    },
  );
});
