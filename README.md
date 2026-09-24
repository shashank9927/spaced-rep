# Recall Code

A small, invite-only spaced-repetition tracker for NeetCode practice problems.

## Run locally

1. Create a Supabase project, then apply the migrations in order. The final migration, [0004_greenfield_rebuild.sql](<supabase/migrations/0004_greenfield_rebuild.sql>), is the RecallCode reset: it removes public application data but deliberately leaves Supabase Auth and Google OAuth intact. Back up an existing public schema before running it.
2. Create a Google OAuth Web client. Add `https://<your-project-ref>.supabase.co/auth/v1/callback` as its authorized redirect URI, then put its client ID and secret in Supabase under Authentication > Providers > Google.
3. Copy `.env.example` to `.env.local` and fill in the values. Use a lowercase value for `BOOTSTRAP_ADMIN_EMAIL`.
4. In Supabase Authentication > URL Configuration, add `http://localhost:3000/auth/callback` and the production callback URL.
5. Run `npm install`, `npm run catalog:fetch`, then `npm run catalog:import`.
6. Start the app with `npm run dev` and sign in using `BOOTSTRAP_ADMIN_EMAIL`; that account becomes the first administrator automatically.

Google users are only granted access after their email exists in `allowed_emails`. The address in `BOOTSTRAP_ADMIN_EMAIL` becomes the first administrator when it signs in.

## Greenfield reset

If this project already has the older RecallCode schema, open Supabase **SQL Editor**, paste the full contents of [0004_greenfield_rebuild.sql](<supabase/migrations/0004_greenfield_rebuild.sql>), and choose **Run**. Then run `npm run catalog:import`. The imported snapshot restores the three catalogs; sign in using `BOOTSTRAP_ADMIN_EMAIL` to bootstrap the owner and invite friends again.

## Checks

Run `npm run lint`, `npm test`, and `npm run build` before deploying.

## Deploy

Deploy to Vercel, add the environment variables from `.env.example`, and add `https://<your-domain>/auth/callback` to Supabase Auth's Site URL and Redirect URLs. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Catalog workflow

`npm run catalog:fetch` creates a local, ignored snapshot from NeetCode's public catalog bundle. `npm run catalog:import` upserts that snapshot into Supabase. The app stores only factual metadata and external links, not problem statements or solutions.
