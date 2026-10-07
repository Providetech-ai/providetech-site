# PROVIDETECH AI ASSISTANCE — website, checkout and admin

This folder is the whole project:

| Page | Address | What it does |
|---|---|---|
| Homepage | `/` | Your landing page. The contact buttons open a short form that saves inquiries. |
| Checkout | `/checkout.html` | People reserve a workshop seat, then pay through your payment link. |
| Admin | `/admin` | You sign in to manage workshops, participants, payments, inquiries and settings. |

It runs in two modes:

- **Demo mode** (how it ships): no setup needed. Everything works on your own computer with sample data saved in your browser. Nothing is sent anywhere.
- **Live mode**: once you connect a free Supabase database (step 2), real reservations and inquiries are saved securely and only your admin account can see them.

---

## 1. Try it on your computer (demo mode)

You need [Node.js](https://nodejs.org) installed (the LTS version is fine).

1. Open a terminal in this folder.
2. Run:
   ```
   npm run preview
   ```
3. Open these in your browser:
   - Website: http://localhost:3000
   - Checkout: http://localhost:3000/checkout.html
   - Admin: http://localhost:3000/admin
4. Sign in to the admin with **admin@providetech.demo** / **demo1234**.

Try this: reserve a seat on the checkout page, then open `/admin` → Participants. Your test reservation is there. Mark it as paid and watch the Overview update.

No Node.js? Python works too: `python3 -m http.server 3000`, then use the same addresses (for the admin, use http://localhost:3000/admin/).

> Opening the files by double-clicking won't work. The pages must be served from a local address like the ones above.

---

## 2. Connect your database (go live) — about 10 minutes

1. Create a free account at [supabase.com](https://supabase.com) and click **New project**. Pick the **Southeast Asia (Singapore)** region so it's fast in the Philippines. Save the database password somewhere safe.
2. When the project is ready, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**. This creates the tables and the security rules.
3. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
4. Paste both into `assets/config.js`:
   ```js
   window.PROVIDETECH_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR-ANON-KEY"
   };
   ```
   The anon key is meant to be public. The database rules decide what visitors can do: they can only see open workshops, reserve a seat and send an inquiry. They can never read anyone's details.

Never paste the **service_role** key anywhere in this project. It bypasses all security rules.

## 3. Create your admin login

1. In Supabase, open **Authentication → Users → Add user**, enter your email and a strong password, and tick **Auto Confirm User**.
2. Open **SQL Editor** and run this, with your email:
   ```sql
   insert into public.admins (user_id, name)
   select id, 'Joshua Rivera' from auth.users where email = 'you@yourdomain.com';
   ```
3. Turn off public sign-ups: **Authentication → Sign In / Providers → Email → Allow new users to sign up: off**. (Even if someone signs up, they still can't see anything unless they're in the admins table. Turning this off is an extra lock.)

To add a team member later, repeat steps 1 and 2 with their email.

## 4. Set up your workshop and payments (in /admin)

1. **Workshops → New batch**: set the date, time, venue, **Zoom link**, seats and price. Set the status to **Open for reservations** when you're ready. Only open batches appear on the checkout page.
2. **Settings → Payment links**: paste your payment link from [PayMongo](https://www.paymongo.com) or [Xendit](https://www.xendit.co). One link can accept card, GCash and Maya, or you can set one link per method.
3. **Settings → Workshop rules**: seat-hold hours, refund days and the bonuses listed at checkout.

How payment confirmation works: a reservation is saved as **Pending** when someone checks out. Once PayMongo is connected (step 7), each person is sent to their own PayMongo checkout and their seat is marked **Paid** automatically the moment they pay. Before that, or for cash and bank transfers, open the participant in **/admin → Participants** and click **Mark as paid**.

## 5. Put it online

**Vercel**
1. Put this folder in a GitHub repository (or use the Vercel CLI: `npx vercel`).
2. In Vercel, click **Add New → Project**, import the repository, keep the default settings (no build command), and deploy.
3. Your admin is at `https://your-domain/admin`.
4. **Payments after going online:** in Supabase → Edge Functions → Secrets, add `SITE_URL` = your live address (e.g. `https://providetech.vercel.app`, no slash at the end). PayMongo then always sends people back to your live site after paying, and Builder Hub emails link to it. Testing on `localhost` still returns to localhost.
5. **Switch to real money:** once PayMongo activates your account, replace `PAYMONGO_SECRET_KEY` with your `sk_live_...` key, then open **/admin → Settings → Connect PayMongo** on the live site once. That registers the live webhook (test and live webhooks are separate).
6. `.vercelignore` keeps the `supabase/` folder, README and local server script off the public website.

**Netlify**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag this whole folder onto the page. (Or connect a GitHub repository.)
2. Your admin is at `https://your-domain/admin`.

Both read the included `vercel.json` / `netlify.toml`, which hide `/admin` from search engines and add basic security headers.

## 6. Send the Zoom link automatically (email)

When a reservation becomes **Paid** (you click *Mark as paid*, or add a walk-in as already paid), the Zoom link of that batch is emailed to the participant, in the language they used at checkout (English, Tagalog or Bisaya). The link is never shown on the website.

The sender is a Supabase Edge Function called `send-workshop-email` (code in `supabase/functions/`). It's already deployed to your project. Only signed-in admins can trigger it. Emails go out through [Resend](https://resend.com) (free for up to 3,000 emails a month).

One-time setup:

1. Create a free account at [resend.com](https://resend.com).
2. **Domains → Add domain**, enter your domain (for example `providetech.ph`) and add the DNS records it shows you where you bought the domain. Wait until it says *Verified*. (Without your own domain, Resend can only send test emails to your own address.)
3. **API Keys → Create API key** (permission: *Sending access*). Copy it. Don't paste it into this project or into a chat.
4. In Supabase: **Edge Functions → Secrets → Add new secret**, add:
   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the key from step 3 |
   | `EMAIL_FROM` | `PROVIDETECH AI Assistance <workshops@your-domain>` |
   | `EMAIL_REPLY_TO` | `providetechaiassistance@gmail.com` (optional: where replies go) |
5. In **/admin → Workshops → Edit**, paste the batch's Zoom invitation link (and optionally the meeting ID and passcode).

**No domain yet? Send from your Gmail instead.** Turn on 2-Step Verification in your Google account, create an **App password** (Google Account → Security → App passwords), then add two more secrets: `GMAIL_USER` (your Gmail address) and `GMAIL_APP_PASSWORD` (the 16-letter app password). While these two exist, emails go out from your Gmail to anyone (about 500 a day). Delete them later to switch back to Resend once your domain is verified.

Mark a test reservation as paid with your own email to check it arrives. Each participant's history shows when the link was emailed, and the participant panel has a **Resend Zoom link** button. If you add the Zoom link after people have already paid, the batch form offers to email all of them at once.

## 7. Confirm payments automatically (PayMongo)

With this on, nobody has to click "Mark as paid": the person pays → PayMongo tells the site → their seat becomes **Paid** → the Zoom link is emailed.

How it works: after someone reserves, the checkout page opens a PayMongo checkout made just for them (GCash, credit card and QR Ph, with their details filled in). The `paymongo-webhook` function receives PayMongo's "paid" notice, checks its signature, double-checks the payment with PayMongo, then updates the reservation. If anything isn't set up yet, the checkout page falls back to your general payment link from Settings.

One-time setup:

1. In the PayMongo dashboard, open **Developers → API keys** and copy the **secret key**. Start with the **test** key (`sk_test_…`) so you can try it without real money.
2. In Supabase: **Edge Functions → Secrets → Add new secret**, name `PAYMONGO_SECRET_KEY`, paste the key. Never put it in this project or in a chat.
3. Optional: add `SITE_URL` with your website address (for example `https://providetech.ph`). People return there after paying.
4. In **/admin → Settings → Automatic payments**, click **Connect PayMongo**. This registers the webhook with PayMongo and stores its signing secret privately.
5. Test: reserve a seat with your own email, pay with one of PayMongo's test cards (listed in their developer docs) or test GCash, and watch the participant turn **Paid** in /admin.
6. Going live: replace `PAYMONGO_SECRET_KEY` with your `sk_live_…` key, then click **Connect PayMongo** again.

Make sure GCash, cards and QR Ph are enabled on your PayMongo account. If one isn't, the checkout falls back to just the method the person picked.

## 8. PROVIDETECH Builder Hub (₱1,999 add-on + members' area)

- **Checkout:** an "Add to your order" box offers the Builder Hub. Price, crossed-out price and access length are set in **/admin → Settings → Builder Hub offer at checkout** (the server always uses this price, never the browser's).
- **After payment:** PayMongo marks the seat paid, the Zoom email goes out, and if they added the hub, their member login is created and a **"Set your password"** email is sent (one-time link, valid 7 days). No passwords are ever emailed.
- **Members' area:** `/hub` — sign in, forgot password (1-hour reset link), Learning, Replays, Prompt Library, Community and Leaderboard.
- **Admin → Builder Hub:** see members and when access ends, add a member by hand, resend the set-password email, extend or end access.
- Edge Functions: `hub-auth` (members' password links) and `hub-admin` (admin actions). They reuse the email sender (Gmail or Resend) from step 6.
- If the "set password" link in emails points to the wrong address, add `SITE_URL` (your live web address) in Supabase secrets.
- **Hub content (Admin → Builder Hub → Courses & lessons / Replays / Prompt Library):** paste Vimeo links (YouTube works too); only items marked **Published** show to members. Members tick lessons as done and see their progress. Tip for Vimeo: set each video's privacy to *Hide from Vimeo* (or *Unlisted*); on a paid Vimeo plan you can also restrict embedding to your website's domain.
- **Community:** channels General, Wins, Help, Builds and Off-topic. Members post, comment, react (👍 🔥 🙌 💡), and edit or delete their own posts. Names show as first name + last initial (e.g. *Maria S.*). Members can post up to 20 times and comment up to 100 times a day.
- **Moderating:** sign in to `/hub` with your **admin** email and password. You appear as **PROVIDETECH Team** and every post gets a ⋯ menu: *Pin to top*, *Hide from members*, *Delete*. You can also hide or delete comments. Hidden posts stay visible to admins only.
- **Leaderboard and points:** +5 per post (first 5 a day), +3 per comment on someone else's post (first 10 a day), +1 for each member who reacts to your post, +10 per lesson finished. Hidden or deleted posts stop counting. Levels: Starter (0), Builder (50), Maker (150), Pro (300), Expert (600), Legend (1000). There's a monthly ranking (resets on the 1st, Philippine time) and an all-time one. Admin → Builder Hub → Members shows each member's points.

---

## Daily use

- **Overview**: today's numbers and anything that needs attention (refund requests, unpaid seats past the hold time, new inquiries, batches without a venue).
- **Workshops**: create and edit batches, copy a batch's reservation link to share on Facebook or Messenger.
- **Participants**: filter by payment status, search, mark as paid, send reminders and workshop details (copy, email or text), move people between batches, handle refunds, add walk-ins, export to CSV.
- **Payments**: money received, refunds and what's still pending, by period.
- **Inquiries**: messages from the homepage form, tracked from New → Contacted → Proposal sent → Won or Lost.
- **Settings**: payment links and workshop rules.

## Privacy and security checklist (before launch)

You will be collecting names, emails, mobile numbers and payment records, so the **Data Privacy Act of 2012** applies.

- [ ] Write a real **Privacy Policy** and **Terms** page and link them in the footer (the links are placeholders now).
- [ ] Use a strong, unique admin password. Only add people you trust to the admins table.
- [ ] Turn off public sign-ups in Supabase (step 3).
- [ ] Never put the Supabase `service_role` key in this project.
- [ ] Check that the 7-day guarantee and payment methods shown on the site match what you actually offer.

## What's next (not built yet)

- **Automatic payment confirmation**: a small serverless function that receives PayMongo/Xendit webhooks and marks reservations as paid by itself.
- **More emails**: reservation confirmation and reminder emails, using the same sender.
- **Spam protection** on the forms (for example Cloudflare Turnstile) if you start getting junk submissions.
- The "Soon" sections in the admin menu: Client Projects, Promo Codes, Reports, Website Content.

## Files

```
index.html            Homepage (+ inquiry form)
checkout.html         Seat reservation page
admin/                The /admin app (index.html, admin.js, admin.css)
assets/config.js      Your Supabase keys (empty = demo mode)
assets/data.js        Shared data layer (demo storage or Supabase)
assets/logo-*.png     Logo files
supabase/schema.sql   Database tables and security rules
supabase/functions/   Edge Functions: Zoom email, PayMongo checkout, webhook and setup
                      (shared code lives in _shared/; run `node supabase/sync-shared.mjs` after editing it)
vercel.json           Vercel settings
netlify.toml          Netlify settings
robots.txt            Keeps /admin and /checkout out of search results
```
