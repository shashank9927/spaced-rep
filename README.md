# Recall Code

A small, invite-only spaced-repetition tracker for NeetCode practice problems.

## Run locally

Use Node.js 22.12 or newer.

1. For a **new, empty** Supabase project, apply every SQL migration in `supabase/migrations` in ascending filename order. For an existing project, apply only migrations that have not already been applied. Never replay `0004` against a database with user data: it resets the public application schema.
2. Create a Google OAuth Web client. Add `https://<your-project-ref>.supabase.co/auth/v1/callback` as its authorized redirect URI, then put its client ID and secret in Supabase under Authentication > Providers > Google.
3. Copy `.env.example` to `.env.local` and fill in the values. Use a lowercase value for `BOOTSTRAP_ADMIN_EMAIL`.
4. In Supabase Authentication > URL Configuration, add `http://localhost:3000/auth/callback` and the production callback URL.
5. Run `npm install`, `npm run catalog:fetch`, then `npm run catalog:import`.
6. Start the app with `npm run dev` and sign in using `BOOTSTRAP_ADMIN_EMAIL`; that account becomes the first administrator automatically.

Google users are only granted access after their email exists in `allowed_emails`. The address in `BOOTSTRAP_ADMIN_EMAIL` becomes the first administrator when it signs in.

## Frankfurt deployment

For the Germany/India study group, create the Supabase project in **Central EU (Frankfurt)**. This repository's [vercel.json](<vercel.json>) pins Vercel Functions to `fra1`, which keeps application-to-database traffic in Frankfurt.

1. Create the new Frankfurt project and apply every migration in filename order.
2. Set its URL, publishable key, and service-role key in `.env.local`, then run `npm run catalog:fetch` followed by `npm run catalog:import`.
3. Reconfigure Google OAuth for the new project callback: `https://<new-project-ref>.supabase.co/auth/v1/callback`.
4. Deploy a Vercel preview with the same Frankfurt environment values. Test sign-in, onboarding, one first attempt, one review, Undo, Schedule, and Progress.
5. Replace the Vercel Production environment values and redeploy. Add `https://<your-domain>/auth/callback` to the new Supabase redirect allow-list.
6. Set `PERF_LOGGING=true` briefly in Vercel to inspect anonymous timing logs, then remove it after verifying warm navigation.

Keep the former project until the new production deployment is verified. Never commit `.env.local` or a service-role key.

## Existing deployment upgrades

Preserve the production database. Check the applied migration history and run only missing, additive migrations. The latest [0014_review_serialization.sql](<supabase/migrations/0014_review_serialization.sql>) serializes competing review/Undo transactions without deleting cards, events, invitations, or profiles. A Git push deploys application code but does not apply database migrations automatically.

The historical `0004_greenfield_rebuild.sql` is destructive and is retained only to reproduce a fresh database in CI. It is not a deployment-upgrade or troubleshooting step. Members can restart their own learning history using the typed-`RESET` confirmation in Settings; this never resets the shared catalog or other accounts.

## Checks

Run `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm audit --audit-level=moderate`, and `npm run build` before deploying.

`npm run test:e2e -- --project=public` uses the installed Microsoft Edge browser and does not touch Supabase data. The complete authenticated browser and database suites run in GitHub Actions against a disposable local Supabase stack; they never use deployment credentials or production data. Developers who already have Docker and the Supabase CLI can run the same database checks with `supabase db start` followed by `npm run test:db`.

Authenticated browser fixtures require explicit `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, and `E2E_SUPABASE_SERVICE_ROLE_KEY` values for a disposable loopback stack, plus a loopback `PLAYWRIGHT_BASE_URL`. Point the app's Supabase environment variables at that same stack. `npm run test:db:api` verifies real concurrent API calls, RLS isolation, Undo, and reset there. CI fails if authenticated configuration is missing; it never substitutes production credentials. Reports, traces, screenshots, and database diagnostics are retained as workflow artifacts.

Real Google OAuth is intentionally verified with one manual production smoke test. Automated browser tests seed isolated Google-shaped test identities without adding an authentication bypass to the application.

## Deploy

Deploy to Vercel, add the environment variables from `.env.example`, and add `https://<your-domain>/auth/callback` to Supabase Auth's Site URL and Redirect URLs. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Catalog workflow

`npm run catalog:fetch` creates a local, ignored snapshot from NeetCode's public catalog bundle. `npm run catalog:import` upserts that snapshot into Supabase. The app stores only factual metadata and external links, not problem statements or solutions.
