This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Property publishing requires a signed-in user and is limited to 3 listings per owner in a rolling 24-hour window. Photo uploads are limited to 10 batches per owner and 30 batches per IP per hour; each batch can contain at most 3 images.

## Listing reports and administrator access

Signed-in users can report a listing from its details. Reports are stored for review,
limited to 5 submissions per account and 20 per IP per hour, and duplicate open reports
from the same account for one listing are rejected. Accounts with the server-side
profile role `admin` can use `/admin` to search/filter listings by city, property type,
status and owner/listing text, review moderation history, restrict listings from public
search with a required owner-visible reason, restore them, or permanently delete them.
Permanent deletion requires a reason and typing `DELETE`; it removes listing images,
saved links and reports while retaining a deletion audit record and an owner-visible
notice in Account. The report queue is available at `/admin/reports`. API endpoints
enforce the role independently of the page.

Restriction is a reversible removal from public listings. The owner sees the reason
and can edit the listing, but only an administrator can restore it. Permanent deletion
is a separate destructive action; a limited audit snapshot and owner notice are retained
even after the listing and its related records are deleted.

Promote a trusted account using an administrative database connection, replacing the
email with the account that should manage reports:

```sql
UPDATE profiles
SET role = 'admin'
WHERE lower(email) = lower('admin@example.com');
```

Do not add a user-facing role editor. New moderation tables and listing reason columns
are created by the backend's startup schema initialization. On existing databases
that use a PostgreSQL `property_status` enum, startup also adds the `removed` value
required for listing restrictions.

## Location and contact privacy

The listing form can request device location only after the user taps the location
button. Exact coordinates and the full address remain private to the owner and
administrators; public listings and maps receive coordinates rounded to 0.001 degrees
(roughly 100 metres) and no full street address. Device geolocation requires HTTPS
outside localhost.

Contact numbers are returned only through an authenticated, rate-limited reveal
endpoint after the listing owner explicitly opts in. New listings require that opt-in.
Existing listings default to not shared after the schema update; owners can enable or
withdraw sharing from the listing edit form. Contact reveals are capped at 20 per
account and 60 per IP per hour.

## Security deployment settings

The browser does not receive SmallTown access or refresh tokens. The API sets
`HttpOnly`, `SameSite=Lax` cookies; `COOKIE_SECURE` defaults to `true` and should
remain enabled in production. For local HTTP development on a LAN address, set
`COOKIE_SECURE=false` in the server environment. The API checks the request
`Origin` on state-changing requests; set `FRONTEND_ORIGIN` to the exact public
frontend origin in production. For local LAN testing with HTTP, `COOKIE_SECURE=false`
also permits the existing localhost and `192.168.1.8:3000` development origins.

For production, serve the frontend and API on the same origin. Set the Next.js
server environment variable `API_INTERNAL_URL` to the private API origin (or use
the platform's same-origin `/api/v1` reverse-proxy route). API requests from the
browser use relative `/api/v1` URLs. `NEXT_PUBLIC_API_URL` is used as a server-side
proxy fallback; do not point production browser requests directly at a separate
API site.

Next.js sends a restrictive `Content-Security-Policy-Report-Only` header and accepts
sanitized reports at `/api/csp-report`. Review reports in the frontend server logs
while exercising listing pages, maps, and Google sign-in before enforcing CSP.
Configure `SUPABASE_URL` for the backend and expose the same public project URL to
the Next.js build as `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) so image origins
can be scoped narrowly. Listing image URLs are limited to UUID WebP objects in the
`property-images` bucket.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
