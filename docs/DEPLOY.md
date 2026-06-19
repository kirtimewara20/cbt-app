# Deploy CBT Platform

Choose one path below. **Render (Option 1)** is easiest from Windows — no Docker or VPS needed.

---

## Option 1: Render (recommended — from GitHub)

**Cost:** Free tier available (services sleep after inactivity; DB free tier expires after 90 days).

### Steps

1. **Push latest code** (includes `render.yaml`):
   ```bash
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```

2. **Sign up:** [render.com](https://render.com) → Continue with GitHub → authorize `kirtimewara20`.

3. **New Blueprint:**
   - Dashboard → **New +** → **Blueprint**
   - Connect repo: `kirtimewara20/cbt-app`
   - Render reads `render.yaml` and creates:
     - PostgreSQL database (`cbt-db`)
     - API service (`cbt-api`)
     - Web service (`cbt-web`)
   - Click **Apply**

4. **Wait ~10–15 min** for first build (both services + DB).

5. **Seed the database** (first time only):
   - Render Dashboard → **cbt-api** → **Shell**
   ```bash
   npx prisma db seed
   ```
   Or from local machine with Render DB **External URL**:
   ```bash
   DATABASE_URL="postgresql://..." pnpm db:seed
   ```

6. **Open your app:**
   - Web: `https://cbt-web-oregon.onrender.com`
   - API docs: `https://cbt-api-oregon.onrender.com/api/docs`

   > Free Postgres is **Oregon only**. Delete old Singapore `cbt-api` / `cbt-web` after Oregon services are Live.

7. **Login:**
   - Admin: `admin@cbt-platform.com` / `Admin@123`
   - Change password after first login.

### If login fails (CORS)

In Render → **cbt-api-oregon** → **Environment**, confirm:
```
APP_URL=https://cbt-web-oregon.onrender.com
```
Then **Manual Deploy** → Redeploy cbt-api-oregon.

### Custom domain (optional)

Render → **cbt-web** → Settings → Custom Domains → add your domain.

Update **cbt-api** env:
```
APP_URL=https://yourdomain.com
```
Update **cbt-web** env and **rebuild**:
```
NEXT_PUBLIC_API_URL=https://cbt-api.onrender.com/api/v1
NEXT_PUBLIC_WS_URL=wss://cbt-api.onrender.com
```
(Or put API behind same domain with a reverse proxy later.)

---

## Option 2: Linux VPS + Docker

For production exams with more control.

1. Rent Ubuntu 22.04 VPS (DigitalOcean, Hetzner, etc.)
2. SSH from Windows: `ssh root@YOUR_SERVER_IP`
3. Install Docker, clone repo, follow `infra/docker/.env.production.example`
4. Run: `./infra/docker/deploy.sh yourdomain.com`

See `infra/docker/docker-compose.prod.yml`.

---

## Option 3: Windows server (internal / LAN only)

You already run PostgreSQL locally:

```powershell
pnpm install
pnpm build
pnpm start:api   # terminal 1
pnpm start:web   # terminal 2
```

Use only on a trusted network — not recommended for public internet exams.

---

## Environment variables reference

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Auto on Render from Postgres |
| `JWT_ACCESS_SECRET` | Yes | Auto-generated on Render |
| `JWT_REFRESH_SECRET` | Yes | Auto-generated on Render |
| `APP_URL` | Yes | Web app URL (CORS) |
| `NEXT_PUBLIC_API_URL` | Yes | Set at web **build** time |
| `NEXT_PUBLIC_WS_URL` | Yes | WebSocket URL for proctoring |
| `REDIS_URL` | No | Optional; rate limiting uses memory if empty |

---

## After deploy checklist

- [ ] Seed database
- [ ] Login as admin and change password
- [ ] Create a test exam and take it as candidate
- [ ] Test proctoring (camera permission in browser)
