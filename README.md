# Survivor Pool — standalone site

Same app you saw in Claude, rebuilt as a real website: a small React app that
uses Firebase to keep everyone's view live and to gate editing to just you
(the host).

Total cost: **$0** — Firebase's free "Spark" plan and Vercel's free tier both
comfortably cover a pool like this.

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Any name is fine (e.g. "survivor-pool"). You can skip Google Analytics.
2. In the left sidebar, open **Build > Realtime Database** → **Create database** → start in **locked mode** (we'll paste our own rules next) → pick any region.
3. Once created, go to the **Rules** tab of the Realtime Database and paste in the contents of `database.rules.json` from this project, then click **Publish**. This makes the pool viewable by anyone with the link, but writable only by someone signed in.
4. In the left sidebar, open **Build > Authentication** → **Get started** → enable the **Email/Password** sign-in method.
5. Still in Authentication, go to the **Users** tab → **Add user** → enter the email and password *you* (the host) want to sign in with. This is the only account that will ever exist — there's no public sign-up in the app.
6. Go to **Project settings** (gear icon) → scroll to **Your apps** → click the **Web** icon (`</>`) to register a web app (any nickname). Firebase will show you a config object — you'll need those values in step 3 below.

## 2. Get the code onto GitHub

1. Create a new empty repository on [github.com](https://github.com) (e.g. `survivor-pool`).
2. Push this project folder to it. If you're new to git, GitHub's "upload files" button in the browser works fine for a project this size — just drag the whole folder in.

## 3. Set your Firebase config

Copy `.env.example` to a new file named `.env.local`, and fill in the values Firebase showed you in step 1.6:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

This file is git-ignored on purpose — it won't get pushed to GitHub. You'll enter the same values directly into Vercel in the next step.

## 4. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com), sign up (free), and click **Add New > Project**.
2. Import the GitHub repo you created. Vercel auto-detects Vite — no config changes needed.
3. Before deploying, open **Environment Variables** and add the same seven `VITE_FIREBASE_...` keys and values from your `.env.local`.
4. Click **Deploy**. In about a minute you'll get a live URL like `survivor-pool-yourname.vercel.app` — that's the real link to send to your group.
5. (Optional) In the Vercel project's **Settings > Domains**, you can attach a custom domain if you own one.

## Using it

- Anyone who opens the link sees the pool live and read-only.
- Click **Host sign-in** and use the email/password you created in step 1.5 to unlock editing — add members, make picks, mark results, toggle paid status, override a week's lock, sync the schedule.
- Each member can also click **Team sign-in**, pick their name, and set their own code the first time — after that they can log into just their own row to make their own picks. Other members' picks stay hidden (an eye-off icon) until that week's games start, then reveal automatically for everyone.
- Every visitor's browser reads the same Firebase data in real time, so once anything changes, everyone sees it within a second or two — no refresh needed.
- Each week's picks lock automatically at 1:00 PM ET that Sunday (hardcoded to the 2026 NFL schedule). The host can override any week to force it locked or unlocked regardless of kickoff, using the clock/lock icon in that week's column.
- The **Head-to-Head** panel flags when two members picked teams that play each other that week — click **Sync schedule** (host-only) once to pull the season's matchups from ESPN so this works.
- The **live result check** and **sync schedule** buttons fetch from ESPN's public scoreboard endpoint directly in the browser. This is far more likely to work here than it did inside the Claude-hosted version (which blocks that kind of outbound request from its sandbox) — but it still depends on ESPN's endpoint staying reachable and CORS-friendly, which isn't guaranteed long-term. If it ever stops working, the "open scoreboard" link and the manual check/X buttons still work as a fallback.

## Local development (optional)

If you want to run it on your own machine before deploying:

```
npm install
npm run dev
```

Requires Node.js installed. Opens at `http://localhost:5173`.

## A note on security

Host sign-in uses real Firebase Authentication, so unlike the PIN in the
Claude-hosted version, that part is genuinely secure: only someone with the
exact email/password you created can write to the database as host. Team
logins are a lighter-weight, app-level code check (like the host PIN was) —
they stop casual peeking between members but aren't enforced by the
database rules, so treat them as a courtesy lock rather than real security.
The Firebase web config values are not secret (they're meant to be public in
client code); what actually protects host-level writes is the
`database.rules.json` you published in step 1.3.
