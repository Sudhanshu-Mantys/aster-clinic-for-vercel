# Quick Vercel Deployment Guide

## 🚀 Deploy to Vercel in 5 Minutes

### Step 1: Prepare Environment Variables

You'll need these from [Stack Auth Dashboard](https://app.stack-auth.com):

```
NEXT_PUBLIC_STACK_API_URL=https://api.stack-auth.com/api/v1
NEXT_PUBLIC_STACK_PROJECT_ID=your-project-id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your-key
```

### Step 2: Push to GitHub

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### Step 3: Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your repository
3. **Important**: Configure these settings:
   - **Root Directory**: Keep as root (`.`)
   - **Build Command**: `BUILD_TARGET=web npm run build:web`
   - **Output Directory**: `renderer/.next`
   - **Install Command**: `npm install`

4. Add environment variables:
   - Click "Environment Variables"
   - Add all three `NEXT_PUBLIC_STACK_*` variables
   - Make sure they're set for all environments (Production, Preview, Development)

5. Click **Deploy**

### Step 4: Verify Deployment

Once deployed, test:
- Login functionality
- Dashboard access
- Team switching
- All UI components

---

## 🔄 Alternative: Deploy via CLI

### Install Vercel CLI
```bash
npm install -g vercel
```

### Login
```bash
vercel login
```

### Deploy
```bash
# First deployment (follow prompts)
vercel

# Production deployment
vercel --prod
```

### Set Environment Variables via CLI
```bash
vercel env add NEXT_PUBLIC_STACK_API_URL
vercel env add NEXT_PUBLIC_STACK_PROJECT_ID
vercel env add NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
```

---

## 🧪 Test Locally Before Deploying

```bash
# Test web version
npm run dev:web

# Open http://localhost:3000
```

---

## 🔧 Common Issues

### Issue: Build fails with "Module not found"
**Solution**: Make sure all dependencies are in `dependencies`, not `devDependencies`

### Issue: Environment variables not working
**Solution**: 
1. Double-check they're prefixed with `NEXT_PUBLIC_`
2. Redeploy after adding env vars: `vercel --prod --force`

### Issue: Images not loading
**Solution**: Images are optimized for web. Verify image paths use `/images/...`

### Issue: API calls failing
**Solution**: Check CORS settings in Stack Auth dashboard. Add your Vercel domain.

---

## 📊 After Deployment

1. **Add Custom Domain** (Optional)
   - Go to your Vercel project → Settings → Domains
   - Add your custom domain

2. **Enable Analytics**
   - Vercel provides free analytics
   - Go to Analytics tab in your project

3. **Set Up Monitoring**
   - Enable error tracking (Sentry integration)
   - Set up uptime monitoring

4. **Configure Stack Auth**
   - Add your Vercel URL to allowed origins
   - Update redirect URLs if needed

---

## 🎯 Your URLs

After deployment:
- **Preview**: `https://[your-project]-[hash].vercel.app`
- **Production**: `https://[your-project].vercel.app`
- **Custom Domain**: Configure in Vercel settings

---

## 💡 Pro Tips

1. **Preview Deployments**: Every PR gets its own preview URL
2. **Instant Rollbacks**: Click "Redeploy" on any previous deployment
3. **Environment-specific vars**: Different values for preview vs production
4. **Automatic HTTPS**: All Vercel deployments use HTTPS automatically

---

## 📚 Resources

- [Vercel Next.js Guide](https://vercel.com/docs/frameworks/nextjs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Stack Auth Docs](https://docs.stack-auth.com)
- [Project Deployment Guide](./DEPLOYMENT.md)

---

## ✅ Deployment Checklist

- [ ] Environment variables configured in Vercel
- [ ] Repository pushed to GitHub/GitLab/Bitbucket
- [ ] Build settings verified in Vercel
- [ ] Test login/signup on deployed site
- [ ] Stack Auth origins updated with Vercel URL
- [ ] Custom domain configured (optional)
- [ ] Analytics enabled
- [ ] Team members granted access to Vercel project

---

**Need Help?** See the full [DEPLOYMENT.md](./DEPLOYMENT.md) guide or open an issue.

