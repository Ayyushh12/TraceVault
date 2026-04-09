# 🚀 TraceVault — Free Hosting Guide (Backend + Frontend)

Complete step-by-step guide to deploy your TraceVault application for **free** using the best available platforms.

---

## 📋 Architecture Overview

| Component | Technology | Free Hosting |
|-----------|-----------|--------------|
| **Frontend** | React + Vite + TypeScript | Vercel / Netlify |
| **Backend** | Node.js + Fastify | Render / Railway |
| **Database** | MongoDB (Mongoose) | MongoDB Atlas (Free M0) |
| **Cache/Redis** | Upstash Redis | Upstash (Free Tier) |
| **File Storage** | S3-compatible | Cloudflare R2 (Free 10GB) |

---

## 1️⃣ MongoDB Atlas (Database) — FREE

> Best free MongoDB hosting. 512 MB storage, shared cluster.

### Steps:
1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Click **"Try Free"** → Create account (Google sign-in works)
3. Choose **M0 Free Tier** (Shared cluster)
4. Select region closest to you (e.g., `Mumbai (ap-south-1)` for India)
5. Set cluster name: `tracevault-cluster`
6. Click **"Create Cluster"** (takes 2-3 minutes)

### Configure Access:
1. Go to **Database Access** → Add Database User
   - Username: `tracevault_admin`
   - Password: Generate a strong password → **copy it**
   - Role: `Atlas Admin`
2. Go to **Network Access** → Add IP Address
   - Click **"Allow Access from Anywhere"** → `0.0.0.0/0`
   - (Required for Render/Railway to connect)
3. Go to **Databases** → Click **"Connect"** → Choose **"Drivers"**
4. Copy the connection string:
   ```
   mongodb+srv://tracevault_admin:<password>@tracevault-cluster.xxxxx.mongodb.net/tracevault?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password

✅ **Your `MONGODB_URI` is ready!**

---

## 2️⃣ Upstash Redis (Cache) — FREE

> 10,000 commands/day free. Perfect for session caching and rate limiting.

### Steps:
1. Go to [https://upstash.com](https://upstash.com)
2. Sign up with GitHub/Google
3. Click **"Create Database"**
   - Name: `tracevault-redis`
   - Region: Select closest (e.g., `ap-south-1`)
   - Type: **Regional**
4. After creation, go to **Details** tab
5. Copy:
   - **UPSTASH_REDIS_REST_URL** → `https://xxx.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN** → `AXxx...`

✅ **Your Redis credentials are ready!**

---

## 3️⃣ Cloudflare R2 (File Storage) — FREE

> 10 GB storage + 10 million reads/month free. S3-compatible API.

### Steps:
1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → Sign up
2. Navigate to **R2 Object Storage** (left sidebar)
3. Click **"Create Bucket"**
   - Name: `tracevault-evidence`
   - Location: Automatic
4. Go to **R2** → **Manage R2 API Tokens** → **Create API Token**
   - Permissions: **Object Read & Write**
   - Specify bucket: `tracevault-evidence`
5. Copy:
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint URL**: `https://<account-id>.r2.cloudflarestorage.com`

### Environment Variables:
```env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=tracevault-evidence
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>
S3_REGION=auto
```

✅ **Your file storage is ready!**

---

## 4️⃣ Backend Deployment — Render.com (BEST FREE OPTION)

> Free 750 hours/month. Auto-deploys from GitHub. Supports Node.js natively.

### Why Render?
- ✅ Free tier with no credit card required
- ✅ Auto-deploy from GitHub on every push
- ✅ Built-in environment variable management
- ✅ HTTPS by default
- ⚠️ Free tier sleeps after 15 min of inactivity (cold start ~30s)

### Steps:

#### A. Push to GitHub
```bash
# If not already a git repo
cd trusty-chain-main
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<your-username>/tracevault.git
git push -u origin main
```

#### B. Deploy on Render
1. Go to [https://render.com](https://render.com) → Sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo → Select `tracevault`
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `tracevault-api` |
| **Region** | Singapore or Oregon |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

5. Add **Environment Variables** (click "Advanced"):

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://tracevault_admin:<password>@tracevault-cluster.xxxxx.mongodb.net/tracevault?retryWrites=true&w=majority
JWT_SECRET=<generate-a-64-char-random-string>
JWT_REFRESH_SECRET=<generate-another-64-char-random-string>
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=tracevault-evidence
S3_ACCESS_KEY=<your-r2-access-key>
S3_SECRET_KEY=<your-r2-secret-key>
S3_REGION=auto
```

6. Click **"Create Web Service"**
7. Wait for build to complete (~2-3 minutes)
8. Your backend URL: `https://tracevault-api.onrender.com`

✅ **Backend is live!**

---

## 5️⃣ Frontend Deployment — Vercel (BEST FREE OPTION)

> Unlimited deployments, global CDN, instant cache invalidation.

### Why Vercel?
- ✅ Zero-config for Vite/React projects
- ✅ Global edge network (blazing fast)
- ✅ Preview deployments for every PR
- ✅ Custom domain support (free)
- ✅ No cold starts (static hosting)

### Steps:

#### A. Update Vite Config for Production
Create a `.env.production` file in the project root:
```env
VITE_API_URL=https://tracevault-api.onrender.com/api
```

#### B. Deploy on Vercel
1. Go to [https://vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **"Add New Project"** → Import your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Framework** | Vite |
| **Root Directory** | `./` (project root) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. Add **Environment Variable**:
   - `VITE_API_URL` = `https://tracevault-api.onrender.com/api`

5. Click **"Deploy"**
6. Your frontend URL: `https://tracevault.vercel.app`

✅ **Frontend is live!**

---

## 🔄 Alternative Free Hosting Options

### Backend Alternatives

| Platform | Free Tier | Cold Start? | Notes |
|----------|-----------|-------------|-------|
| **Render** ⭐ | 750 hrs/month | Yes (~30s) | Best overall, easiest setup |
| **Railway** | $5 free credit/month | No | Better performance, runs out faster |
| **Fly.io** | 3 shared VMs | No | Best performance, slightly complex setup |
| **Koyeb** | 1 nano instance | Yes | Good alternative to Render |
| **Cyclic.sh** | 100k requests/month | Yes | Serverless, very easy |

### Frontend Alternatives

| Platform | Free Tier | Notes |
|----------|-----------|-------|
| **Vercel** ⭐ | Unlimited | Best for React/Vite, fastest CDN |
| **Netlify** | 100 GB bandwidth | Great alternative, easy redirects |
| **Cloudflare Pages** | Unlimited | Fastest edge network globally |
| **GitHub Pages** | Unlimited | Good for static, needs SPA redirect config |

---

## 🛠️ Post-Deployment Checklist

- [ ] Test login at `https://tracevault.vercel.app/login`
- [ ] Verify API connectivity: `https://tracevault-api.onrender.com/api/health`
- [ ] Upload a test evidence file
- [ ] Check MongoDB Atlas → Collections → verify data is stored
- [ ] Set up a custom domain (optional, free on Vercel)
- [ ] Enable Render's "Keep Alive" via a free cron service like [cron-job.org](https://cron-job.org) to prevent cold starts

---

## 💡 Pro Tips

1. **Prevent Cold Starts**: Use [cron-job.org](https://cron-job.org) (free) to ping your Render backend every 14 minutes
2. **Custom Domain**: Both Vercel and Render support free custom domains with auto-SSL
3. **Monitor**: Use [UptimeRobot](https://uptimerobot.com) (free, 50 monitors) to track uptime
4. **Logs**: Render provides free log streaming. Check it for any runtime errors

---

## 📊 Total Monthly Cost: **$0.00** 🎉

| Service | Cost |
|---------|------|
| MongoDB Atlas M0 | Free |
| Upstash Redis | Free |
| Cloudflare R2 | Free (10 GB) |
| Render Backend | Free (750 hrs) |
| Vercel Frontend | Free |
| **Total** | **$0.00** |
