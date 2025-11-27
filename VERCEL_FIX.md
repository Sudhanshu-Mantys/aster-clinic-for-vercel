# Vercel Deployment Fix - ERR_TOO_MANY_REDIRECTS

## 🔧 Issues Fixed

### Problem
The app worked perfectly on localhost but failed on Vercel with **ERR_TOO_MANY_REDIRECTS** error.

### Root Causes
1. **Missing index page** - No `/` route, only `/home`
2. **Wrong Next.js config** - Used `output: 'export'` for Vercel (should only be for Electron)
3. **Trailing slash conflicts** - Different settings for Electron vs Web

### Solutions Applied

#### 1. Created Index Page (`renderer/pages/index.tsx`)
- Redirects root `/` to `/home`
- Prevents 404 errors on root access

#### 2. Updated Next.js Config (`renderer/next.config.js`)
- Detects Vercel environment automatically
- Uses standard Next.js build for web (not static export)
- Only uses `output: 'export'` for Electron builds
- Removes trailing slashes for web deployment

#### 3. Updated Vercel Config (`vercel.json`)
- Simplified configuration
- Removed conflicting URL settings
- Let Next.js handle routing

#### 4. Fixed Router Methods
- Changed auth redirects from `router.push()` to `router.replace()`
- Prevents redirect loops by not adding to history stack

---

## 🚀 How to Deploy Fixed Version

### Step 1: Commit and Push Changes
```bash
git add .
git commit -m "Fix Vercel deployment - resolve redirect loop"
git push origin main
```

### Step 2: Vercel Will Auto-Deploy
If you connected your GitHub repo to Vercel, it will automatically:
1. Detect the push
2. Start a new build
3. Deploy the fixed version

### Step 3: Verify Deployment
Once deployed, test these paths:
- ✅ `https://your-app.vercel.app/` → Should redirect to `/home`
- ✅ `https://your-app.vercel.app/home` → Should show home page
- ✅ `https://your-app.vercel.app/login` → Should show login
- ✅ `https://your-app.vercel.app/dashboard` → Should redirect to `/home` if not logged in

---

## 🧪 Test Locally First

Before deploying, test the web version locally:

```bash
# Test web build
npm run build:web
npm run start:web

# Visit http://localhost:3000
```

Test these scenarios:
1. Visit root `/` → Should redirect to `/home`
2. Login → Should redirect to `/home` (or `/dashboard` if team selected)
3. Navigate between pages → No redirect loops

---

## 📋 Changes Summary

| File | Change | Reason |
|------|--------|--------|
| `renderer/pages/index.tsx` | **Created** | Handle root URL |
| `renderer/next.config.js` | **Updated** | Detect Vercel, disable export mode |
| `vercel.json` | **Simplified** | Remove conflicting settings |
| `renderer/pages/home.tsx` | **Updated** | Use `router.replace()` |
| `renderer/pages/dashboard.tsx` | **Updated** | Use `router.replace()` |

---

## 🔍 How to Debug Future Issues

### Check Vercel Build Logs
1. Go to your Vercel dashboard
2. Click on the failed deployment
3. Check "Build Logs" tab
4. Look for errors

### Check Runtime Logs
1. Go to "Functions" tab in Vercel
2. Check for runtime errors
3. Look at Network tab in browser DevTools

### Common Issues

**Issue**: Still getting redirects
- **Solution**: Clear browser cache and cookies
- Try in incognito mode

**Issue**: Pages not found
- **Solution**: Check that all pages exist in `renderer/pages/`
- Verify file names match routes

**Issue**: Environment variables not working
- **Solution**: Double-check they're set in Vercel dashboard
- Make sure they start with `NEXT_PUBLIC_`

---

## ✅ Verification Checklist

After deployment, verify:
- [ ] Root URL (`/`) works without redirect loop
- [ ] Login flow works correctly
- [ ] Dashboard access works (with proper redirects)
- [ ] Logout and re-login works
- [ ] Team switching works
- [ ] All images load
- [ ] CSS styles are applied

---

## 🎯 Next Steps

1. **Push changes to GitHub**
2. **Wait for Vercel auto-deployment**
3. **Test the live site**
4. **If successful, update Stack Auth settings** with your Vercel URL

---

## 📞 Still Having Issues?

If you still see redirect loops:

1. **Force redeploy on Vercel**
   ```bash
   vercel --prod --force
   ```

2. **Check Vercel environment detection**
   - Look at build logs for "📦 Next.js Build Config"
   - Should show `isVercel: true` and `isWebBuild: true`

3. **Clear all caches**
   - Browser cache
   - Vercel cache (in deployment settings)
   - CDN cache (if using custom domain)

---

## 🌐 Differences: Electron vs Web

| Feature | Electron Build | Web Build (Vercel) |
|---------|---------------|-------------------|
| Output | Static export | Standard Next.js |
| Trailing Slash | Yes | No |
| Image Optimization | Disabled | Enabled |
| Build Command | `npm run build` | `npm run build:web` |
| Detects via | `npm_lifecycle_event` | `VERCEL=1` env var |

Both versions share the same:
- UI components
- Authentication logic
- Business logic
- Styles

---

**Fixed**: November 27, 2025  
**Status**: ✅ Ready for deployment

