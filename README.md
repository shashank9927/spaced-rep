# Recall Code

A small, invite-only spaced-repetition tracker for NeetCode practice problems.

## Run locally

1. Create a Supabase project, then apply **every** SQL migration in `supabase/migrations` in ascending filename order. On a fresh project this includes the greenfield schema, security, workflow, and review-result RPC migrations. The `0004` migration resets only the public application schema; it deliberately leaves Supabase Auth and Google OAuth intact.
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

## Greenfield reset

If this project already has the older RecallCode schema, open Supabase **SQL Editor**, paste the full contents of [0004_greenfield_rebuild.sql](<supabase/migrations/0004_greenfield_rebuild.sql>), and choose **Run**. Then apply the remaining migrations in ascending order and run `npm run catalog:import`. The imported snapshot restores the three catalogs; sign in using `BOOTSTRAP_ADMIN_EMAIL` to bootstrap the owner and invite friends again.

## Checks

Run `npm run lint`, `npm test`, and `npm run build` before deploying.

## Deploy

Deploy to Vercel, add the environment variables from `.env.example`, and add `https://<your-domain>/auth/callback` to Supabase Auth's Site URL and Redirect URLs. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Catalog workflow

`npm run catalog:fetch` creates a local, ignored snapshot from NeetCode's public catalog bundle. `npm run catalog:import` upserts that snapshot into Supabase. The app stores only factual metadata and external links, not problem statements or solutions.
