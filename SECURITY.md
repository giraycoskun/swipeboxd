# Security

## Reporting

Open a **private security advisory** on GitHub (Security → Report a vulnerability). Do not open a public
issue for a vulnerability. This is a single-person project, not a company: expect an answer within a few
days, not within an hour.

## What this software assumes

- **It is not multi-tenant.** A deployment serves one household: one library, one admin, and guests who
  join a session by link. Anything that would let a guest read the admin's library must be refused.
- **The provider is trusted; the browser is not.** Provider URLs, tokens and admin credentials stay on
  the server. A private or LAN provider URL is refused for user-supplied (BYOP) input unless
  `ALLOW_PRIVATE_PROVIDER_URLS=true`, because that switch turns the app into an SSRF gadget.
- **A member is a name and a signed cookie.** There are no passwords for guests; `AUTH_SECRET` signs the
  session, the guest-lending token and the admin cookie, and a deployment that shares one secret between
  replicas shares one session key.
- **Images are proxied on purpose.** Posters are fetched by the app with a bounded queue and a timeout
  rather than hot-linked, which keeps a slow media server from leaking its address to every client — and
  keeps `PLEX_IMAGE_ALLOWED_HOSTS` meaningful.
- **Set `USE_SECURE_COOKIES=true` behind HTTPS**, and keep the security headers (`X_FRAME_OPTIONS`,
  `CSP_FRAME_ANCESTORS`) at their defaults unless you are embedding the app deliberately.
