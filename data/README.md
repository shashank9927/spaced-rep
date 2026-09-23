# Catalog snapshot

Run `npm run catalog:fetch` to generate `catalog.snapshot.json` from NeetCode's public problem-list bundle. Commit the generated snapshot when deliberately updating the catalog, then run `npm run catalog:import` to upsert it into Supabase.

The snapshot contains only titles, difficulties, topics, list memberships, and external links. It excludes problem statements, solutions, videos, and user progress.
