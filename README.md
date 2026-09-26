# AILOTTOLIA

Responsive lotto number generator.

- 5 games
- 6 unique numbers per game
- Numbers 1–45
- No AI API required for the initial version

## Supabase administrator login

`/admin` signs in with the existing Supabase email/password account. The server
validates the user with Supabase on every protected request and permits only the
user UUID already named in the `weekly_prompts` administrator RLS policy.
Project URL and publishable key in `lib/supabase.js` are public configuration;
no service-role key, user password or refresh token is stored in the repository.

The access token lives in a Secure, HttpOnly, SameSite=Strict cookie, for at most
one hour. Sign in again when it expires. Logout clears this browser's cookie and
requests Supabase local sign-out. As with standard Supabase JWT sessions, a copied
access token remains valid until its expiry. Supabase enforces login rate limits.
All POST requests require the production origin or this deployment's VERCEL_URL.

The dashboard reads up to 20 latest rows from `public.weekly_prompts` using the
signed-in user's token and existing RLS. This change does not save prompts, alter
RLS, collect statistics or apply prompts to the public number generator. The
existing public-read policy includes inactive prompts as well as active ones.

Vercel: Framework Other, Node 22.x; build `npm run build`, output `public`.
The build publishes only index.html and the three admin assets; API functions
are deployed separately by Vercel. No added environment variables are required
for this existing project. Preview origins use Vercel's provided VERCEL_URL.

Run `npm test` for mocked authentication, authorization, CSRF and failure tests.
A real administrator sign-in must be verified in the browser by the account owner.
