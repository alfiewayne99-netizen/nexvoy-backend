# Backend Deployment Guide

## Option 1: Render (Recommended - Free Tier)

### Steps:
1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repo or use "Deploy from Git URL"
4. Configure:
   - **Name:** nexvoy-api
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node app.js`
   - **Plan:** Free

5. Add Environment Variables:
   ```
   NODE_ENV=production
   JWT_SECRET=<generate-random-string>
   ALLOWED_ORIGINS=https://nexvoy.vercel.app,https://nexvoy.travel
   MONGODB_URI=<your-mongodb-uri>
   STRIPE_SECRET_KEY=<your-stripe-key>
   STRIPE_PUBLISHABLE_KEY=<your-stripe-pk>
   STRIPE_WEBHOOK_SECRET=<your-webhook-secret>
   OPENAI_API_KEY=<your-openai-key>
   ```

6. Click "Create Web Service"

### Custom Domain:
1. In Render dashboard, go to your service
2. Click "Settings" → "Custom Domain"
3. Add: `api.nexvoy.travel`
4. Follow DNS instructions (CNAME record)

---

## Option 2: Railway

### Steps:
1. Go to https://railway.app and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo or deploy from Git URL
4. Railway will auto-detect Node.js and deploy

5. Add Environment Variables:
   - Go to "Variables" tab
   - Add the same vars as above

6. Custom Domain:
   - Go to "Settings" → "Domains"
   - Add custom domain: `api.nexvoy.travel`
   - Follow DNS instructions

---

## Quick Deploy (One-Click)

### Render Deploy Button:
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/nexvoy)

---

## After Deployment

1. **Get your backend URL** (e.g., `https://nexvoy-api.onrender.com`)

2. **Update Frontend API URL:**
   ```bash
   cd /projects/nexvoy/website
   echo "REACT_APP_API_URL=https://your-backend-url" > .env.production
   vercel --prod
   ```

3. **Add DNS Record for api.nexvoy.travel:**
   ```
   Type: CNAME
   Name: api
   Value: <your-backend-url>
   ```

4. **Test the API:**
   ```bash
   curl https://api.nexvoy.travel/api/alerts
   ```

---

## Environment Variables Checklist

| Variable | Required | Source |
|----------|----------|--------|
| NODE_ENV | Yes | `production` |
| JWT_SECRET | Yes | Generate random string |
| ALLOWED_ORIGINS | Yes | Your frontend URLs |
| MONGODB_URI | Yes | MongoDB Atlas |
| STRIPE_SECRET_KEY | For payments | Stripe Dashboard |
| STRIPE_PUBLISHABLE_KEY | For payments | Stripe Dashboard |
| STRIPE_WEBHOOK_SECRET | For webhooks | Stripe CLI/Dashboard |
| OPENAI_API_KEY | For AI features | OpenAI Dashboard |

---

## Troubleshooting

### Build fails:
- Check Node.js version (18+)
- Run `npm install` locally to verify

### CORS errors:
- Update `ALLOWED_ORIGINS` with your frontend URL
- Restart the service

### Database connection fails:
- Verify MongoDB Atlas IP whitelist (allow all: `0.0.0.0/0`)
- Check connection string format

---

## Current Status
- ✅ Frontend: https://nexvoy.vercel.app
- ⏳ Backend: Pending deployment
- ⏳ API Domain: api.nexvoy.travel (DNS pending)
