# Hostinger deployment

Use Node.js 22 or 24 and the Next.js framework preset, with the repository root as the application root.

- Build command: `npm run build`
- Start command: `npm run start`

The build script runs `next build --webpack` to bypass the failing Turbopack PostCSS worker startup path, including errors referring to generated Giordano font CSS. If Hostinger overrides the package script with `next build`, change that override to `npm run build` or `npx next build --webpack`.

## Production configuration

In the website dashboard's Environment variables section, set these server variables using your existing values:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_PLACES_API_KEY` | Authenticate to Places API (New). |
| `GOOGLE_PLACE_ID` | Identify the business whose reviews appear. |
| `DATABASE_URL` | Connect to the PostgreSQL CMS, including saved review visibility. |
| `SESSION_SECRET` | Authenticate dashboard sessions. |

Preserve other existing application variables. Values in your local `.env.local` are not automatically copied to Hostinger. Keep credentials out of Git.

Redeploy the updated source after changing the build command. For a GitHub deployment, the updated code must be on the configured branch; for a ZIP deployment, upload updated source instead of reusing the previous ZIP. Exclude `.next` and `node_modules` from uploads.

After deployment succeeds:

1. Open `/admin/reviews` and check that Google reviews load. Missing Google variables are named in the dashboard and server logs without exposing their values.
2. Use **Automatically show new Google reviews** and save. To hide a review, uncheck it and save; hiding survives Google refreshes.
3. Click **Refresh now**, then check `/#testimonials`.

## Missing Testimonials

Check deployment and runtime logs: Google credentials may be missing, Google's request may fail, or the database may be unavailable. Public pages suppress imported/manual reviews if saved visibility settings cannot be loaded, so previously hidden reviews are not accidentally published. The database must contain the `page_sections` table defined in `src/lib/db/schema.sql`.

Google provides up to five relevance-selected reviews. The app sorts those newest first and refreshes its Google cache on visits after an hour. It cannot guarantee a complete chronological Google review feed.

Hostinger references: [build troubleshooting](https://www.hostinger.com/support/fix-failed-to-build-application-error-hostinger-node-js/), [environment variables](https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/), [redeploying](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/).
