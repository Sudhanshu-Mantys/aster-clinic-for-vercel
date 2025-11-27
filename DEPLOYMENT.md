# Deployment Guide

This project supports both **Electron Desktop App** and **Web Application** deployments.

## 🌐 Web Deployment (Vercel)

### Prerequisites
1. A [Vercel account](https://vercel.com)
2. Stack Auth credentials (from [Stack Auth Dashboard](https://app.stack-auth.com))

### Environment Variables
Create a `.env.local` file in the project root with:

```bash
NEXT_PUBLIC_STACK_API_URL=https://api.stack-auth.com/api/v1
NEXT_PUBLIC_STACK_PROJECT_ID=your-project-id-here
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your-publishable-key-here
```

### Deploy to Vercel

#### Option 1: Deploy via Vercel CLI (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add the three Stack Auth variables

5. For production deployment:
```bash
vercel --prod
```

#### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket

2. Go to [Vercel Dashboard](https://vercel.com/dashboard)

3. Click "New Project"

4. Import your repository

5. Configure build settings:
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `renderer/.next`
   - **Install Command**: `npm install`

6. Add environment variables:
   - `NEXT_PUBLIC_STACK_API_URL`
   - `NEXT_PUBLIC_STACK_PROJECT_ID`
   - `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`

7. Click "Deploy"

### Testing Web Version Locally

```bash
# Development mode
npm run dev:web

# Production build
npm run build:web
npm run start:web
```

---

## 🖥️ Desktop App Deployment (Electron)

### Development
```bash
npm run dev
```

### Build Desktop App

```bash
npm run build
```

This creates installers in the `/dist` folder for your platform:
- **macOS**: `.dmg` file
- **Windows**: `.exe` installer
- **Linux**: `.AppImage`, `.deb`, or `.rpm`

### Cross-Platform Building

To build for multiple platforms, update `electron-builder.yml`:

```yaml
appId: com.aster.clinics
productName: Aster Clinics
directories:
  output: dist
files:
  - app
  - renderer
  - package.json
mac:
  target:
    - dmg
    - zip
win:
  target:
    - nsis
    - portable
linux:
  target:
    - AppImage
    - deb
```

### Distribution Options

1. **GitHub Releases**: Upload built installers to GitHub Releases
2. **Direct Download**: Host installers on your website
3. **Auto-Updates**: Integrate `electron-updater` for automatic updates

---

## 🔄 Hybrid Development Workflow

### Running Both Versions Simultaneously

**Terminal 1 - Electron:**
```bash
npm run dev
```

**Terminal 2 - Web:**
```bash
npm run dev:web
```

### Shared Components
All UI components in `/renderer/components` are shared between both versions, ensuring consistent UI/UX.

---

## 🚀 CI/CD Setup

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:web
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}

  build-electron:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: electron-${{ matrix.os }}
          path: dist/
```

---

## 🔧 Troubleshooting

### Web Version Issues

**Issue**: "Module not found" errors
- **Solution**: Ensure all dependencies are installed: `npm install`

**Issue**: Environment variables not working
- **Solution**: Prefix all public variables with `NEXT_PUBLIC_`

### Electron Version Issues

**Issue**: Build fails
- **Solution**: Run `npm run postinstall` to rebuild native dependencies

**Issue**: App won't start
- **Solution**: Check that `app/background.js` exists and is compiled

---

## 📊 Monitoring & Analytics

For production deployments, consider adding:
- **Vercel Analytics** for web version
- **Sentry** for error tracking (both versions)
- **PostHog** or **Mixpanel** for product analytics

---

## 🔐 Security Notes

1. **Never commit** `.env.local` or any files containing secrets
2. **Always use** environment variables for sensitive data
3. **Rotate** API keys regularly
4. **Enable** CORS protection in production
5. **Use HTTPS** for all API communications

---

## 📝 Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Run Electron app in development |
| `npm run dev:web` | Run web app in development |
| `npm run build` | Build Electron app |
| `npm run build:web` | Build web app for production |
| `npm run start:web` | Run production web build locally |

---

## 🎯 Next Steps

1. ✅ Set up environment variables
2. ✅ Test web version locally with `npm run dev:web`
3. ✅ Deploy to Vercel
4. ✅ Test desktop version with `npm run dev`
5. ✅ Build and distribute desktop app with `npm run build`

For more help, see:
- [Next.js Documentation](https://nextjs.org/docs)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Stack Auth Documentation](https://docs.stack-auth.com)

