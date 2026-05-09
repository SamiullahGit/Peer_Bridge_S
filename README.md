# Peer Bridge - NUST Peer Mentorship Platform (MERN)

Full-stack rewrite of the original vanilla-JS / MySQL PeerBridge into the MERN stack:

| Layer    | Tech                                  |
| -------- | ------------------------------------- |
| Frontend | **React** 18 + Vite + React Router 6  |
| Backend  | **Express** 4 + Node 18+              |
| Database | **MongoDB** (via Mongoose 8)          |
| Misc     | JWT auth, bcryptjs, Multer uploads, PDFKit certificates, nodemailer (production) |

The look-and-feel and every feature of the original app are preserved 1:1. Only the implementation has moved from MySQL/vanilla-JS to MongoDB/React.

---

## Folder layout

```
Peer_Bridge_MERN/
├── backend/
│   ├── config/db.js              ← Mongo connection
│   ├── middleware/auth.js        ← JWT bearer-token check
│   ├── models/                   ← Mongoose schemas (one file per collection)
│   ├── routes/                   ← Express routers, one per /api/<resource>
│   ├── services/
│   │   ├── xpManager.js          ← Awards XP, computes levels, queues notifications
│   │   └── certificateGenerator.js
│   ├── scripts/seed.js           ← `npm run seed` to drop/repopulate the DB
│   ├── uploads/                  ← Multer destination (gitignored)
│   ├── certificates/             ← Generated PDFs (gitignored)
│   ├── server.js                 ← Express entry point
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/client.js         ← `pb` fetch wrapper + xp_earned event bus
    │   ├── context/AuthContext.jsx
    │   ├── components/           ← Reusable bits (Sidebar, Avatar, modals, …)
    │   ├── pages/                ← One file per route
    │   ├── styles/               ← shared.css / feed.css / messages.css / etc
    │   ├── utils/                ← time / role / avatar / format helpers
    │   ├── App.jsx               ← Routes
    │   └── main.jsx              ← React entry
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Setup

### 1. Prerequisites

- Node.js v18+
- MongoDB v6+ running locally on `mongodb://localhost:27017` (or set `MONGO_URI` in `.env`)
- A NUST email address for OTP login, e.g. `you@nust.edu.pk`

### 2. Backend

```bash
cd backend
copy .env.example .env       # Windows  (cp on macOS/Linux)
# Edit .env if you want a custom Mongo URI / JWT secret

npm install
npm run seed                 # drops + reseeds the database with the NUST demo data
npm run dev                  # starts the API on http://localhost:4000 (nodemon)
# or: npm start
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                  # starts Vite on http://localhost:5173
```

Open http://localhost:5173 in your browser. Vite proxies `/api`, `/uploads` and `/certificates` to the Express server on port 4000 - no CORS gymnastics required.

### 4. Production build

```bash
cd frontend && npm run build
# Serve `frontend/dist` with any static host (Netlify, nginx, Vercel, etc.)
# and point it at the Express API.
```

---

## Deploy for free (MongoDB Atlas + Render + Vercel + Cloudinary)

End-to-end recipe to get the project on the public internet without paying anything.

### Step 1 - MongoDB Atlas (the database)

1. Sign up at https://www.mongodb.com/cloud/atlas — pick the **M0 Free** cluster.
2. Choose AWS / Mumbai (or whichever region is closest).
3. **Database Access** → Add New Database User. Username: `peerbridge`, choose "Autogenerate" for the password and **save it somewhere safe**.
4. **Network Access** → Add IP Address → "Allow Access from Anywhere" (`0.0.0.0/0`). Necessary because Render's outbound IPs are dynamic.
5. **Connect** → Drivers → copy the connection string. It looks like:
   ```
   mongodb+srv://peerbridge:<password>@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with the password you saved, and append the database name: `.../peer_bridge?retryWrites=true&w=majority`.
6. Locally, drop this connection string into `backend/.env` as `MONGO_URI=...` and run `npm run seed` once. This populates Atlas with the demo users / posts / events.

### Step 2 - Cloudinary (persistent file uploads)

1. Sign up at https://cloudinary.com — free plan is fine (25 GB storage + 25 GB monthly bandwidth).
2. On the dashboard, copy three values:
   - **Cloud name** (e.g. `dxyz123ab`)
   - **API Key** (digits)
   - **API Secret** (alphanumeric)
3. Save these — you'll paste them into Render in the next step.

> If you skip Cloudinary, the backend will fall back to writing uploads to local disk on Render. They'll vanish on every redeploy.

### Step 3 - Render (the backend)

1. Push the project to GitHub (the whole `Peer_Bridge_MERN/` folder).
2. Sign in to https://render.com → **New +** → **Web Service** → connect your GitHub repo.
3. Settings:
   - **Root Directory** : `Peer_Bridge_MERN/backend`
   - **Build Command**  : `npm install`
   - **Start Command**  : `npm start`
   - **Instance Type**  : Free
4. **Environment** tab → add these variables:
   ```
   PORT=4000
   MONGO_URI=<the Atlas connection string from Step 1>
   JWT_SECRET=<any random 32+ char string>
   NODE_ENV=production
   CLOUDINARY_CLOUD_NAME=<from Step 2>
   CLOUDINARY_API_KEY=<from Step 2>
   CLOUDINARY_API_SECRET=<from Step 2>
   ```
5. **Create Web Service**. After ~3 minutes you'll get a URL like `https://peer-bridge-api.onrender.com`. Test it — `https://<your-render-url>/api/health` should return `{ "ok": true }`.

> **Free-tier gotcha:** Render free services sleep after 15 minutes of inactivity. The first request after a sleep takes ~30 seconds to wake up. Subsequent requests are fast.

### Step 4 - Vercel (the frontend)

1. Sign in to https://vercel.com with your GitHub account.
2. **Add New** → **Project** → import the same repo.
3. Settings:
   - **Root Directory** : `Peer_Bridge_MERN/frontend`
   - **Framework Preset** : Vite (auto-detected)
   - **Build Command** : leave default (`npm run build`)
   - **Output Directory** : leave default (`dist`)
4. **Environment Variables** → add:
   ```
   VITE_API_BASE=https://<your-render-url>/api
   ```
   (Use the URL from Step 3 — note the `/api` suffix.)
5. **Deploy**. After ~2 minutes you'll have a live URL like `https://peer-bridge.vercel.app`.

### Step 5 - Verify everything works

1. Open the Vercel URL in a fresh browser window.
2. Click "Get started" → enter a NUST email → check the Render logs for the dev OTP (or temporarily `NODE_ENV=development` on Render to surface it in the response).
3. Sign in, upload a post image, refresh — the image still loads (it's on Cloudinary, not Render).
4. Trigger a redeploy on Render — uploads still load.

That's it. Costs: $0/month. Limits: ~25 GB Cloudinary, 512 MB Atlas, Render sleeps when idle.

---

## Default accounts

All seeded passwords are **`Test@123`**. The OTP is also printed in the server console and surfaced in the browser modal in dev mode - no real email server needed.

| Email                                | Role    |
| ------------------------------------ | ------- |
| `syed.hassan@nust.edu.pk`            | Mentor  |
| `aiman.batool@nust.edu.pk`           | Mentor  |
| `areeba.noor@nust.edu.pk`            | Mentor  |
| `zainab.fatima@student.nust.edu.pk`  | Student |
| `rimsha.asif@student.nust.edu.pk`    | Student |

(See `backend/scripts/seed.js` for the full list of 15 users.)

---

## Feature parity checklist

Everything from the original Vanilla / MySQL build is preserved:

- [x] OTP signup / password login (NUST email-domain whitelist)
- [x] Profile setup with avatar upload
- [x] Post feed (4 categories, like, bookmark, reply, image)
- [x] Mentor directory + ratings + auto-flag at <2.0 with 5+ reviews
- [x] Mentorship requests (sidebar badge + accept / decline modal)
- [x] Resource library (upload / download / category filter)
- [x] Events calendar (upcoming / past, organiser-only delete)
- [x] 1:1 messaging (inbox + chat overlay + 4-second polling)
- [x] Reports (post auto-hide at 5, user auto-lock at 10)
- [x] XP system (Bronze/Silver/Gold/Platinum/Legend) + daily-login bonus
- [x] Verified Mentor Certificate (PDFKit, 24h cooldown, mentors >=500 XP)
- [x] Student >= 300 XP -> "Become a Mentor" promotion flow

---

## Notes for graders / future maintainers

- **Mongoose vs SQL.** Foreign keys become `ObjectId` refs and are joined with `populate()`. The conversation-list query (which used to be a SQL window function) is now an aggregation pipeline in `routes/messages.js`.
- **Schemaless safety.** `models/User.js` validates the email domain inline so the same NUST whitelist enforced by the original `CHECK` constraint still applies.
- **No long-lived SSE.** The original SSE stream that delivered passive XP toasts was replaced (in both this version and the latest vanilla build) with `/api/xp/pending` polled every 15 seconds while the tab is visible.
- **State management.** No Redux. `AuthContext` holds the current user / token. Everything else is local component state - the API surface is the only shared store.
- **Code style.** Component files are kept small and focused; the largest page (`Feed.jsx`) delegates to `PostCard`, `ComposerModal`, `ChatOverlay`, `ReportModal` and `RequestsModal` so each file fits comfortably in a single screenful.
