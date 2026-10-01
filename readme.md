# GB Adventure — Travel Agency + Admin CMS

A Netlify/GitHub-ready GB Adventure travel agency website based on the Travisa visual style, with GB Adventure content, animations, packages, team, social links, booking UI and a persistent Netlify Functions + Blobs admin CMS.

## Deploy on Netlify
- Import this repository into Netlify.
- `netlify.toml` sets the publish directory to `.` and functions directory to `netlify/functions`.
- No custom build command is required.
- Netlify automatically deploys the function in `netlify/functions/api.mjs`.
- Netlify Blobs provides persistent multi-device content storage when the site is deployed through Netlify.

## Admin panel
Open `/admin` or `/admin.html`.

### Admin login
The admin panel opens directly on the login screen. There is no Create Account / First-time Setup screen. The initial owner account is seeded by the Netlify backend when the users store is empty.

Passwords are stored as scrypt hashes in Netlify Blobs and the session uses an HttpOnly cookie. Set `GB_SESSION_SECRET` in Netlify environment variables before production use. If Blobs is temporarily unavailable, the API returns a readable error response instead of a function crash/HTTP 512.

## Admin capabilities
- Website/SEO settings
- Logo and favicon
- Hero slides
- Packages: add/edit/delete, pricing, images, itinerary, included/excluded, activities
- Destinations and services
- Team members: image, name, role, description, Facebook, Instagram, TikTok, WhatsApp
- Reviews
- Blogs and FAQs
- Global social links
- Booking inbox and booking status
- Admin/user CRUD and roles
- Website ownership transfer
- JSON backup/restore

## Package details modal
Every package has a dedicated details modal with a clearly visible **X close button**, Cancel/Book actions, and Escape-key closing.

## Security note
Set `GB_SESSION_SECRET` to a long random secret before production use. Do not share admin credentials.
