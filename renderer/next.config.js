/** @type {import('next').NextConfig} */

// Detect if we're building for Electron or Web
// Check for Vercel environment or explicit web build commands
const isVercel = process.env.VERCEL === '1'
const isWebBuild = process.env.npm_lifecycle_event === 'dev:web' || 
                   process.env.npm_lifecycle_event === 'build:web' ||
                   process.env.BUILD_TARGET === 'web' ||
                   isVercel

const isElectronBuild = !isWebBuild && (
  process.env.npm_lifecycle_event === 'dev' || 
  process.env.npm_lifecycle_event === 'build' ||
  process.env.BUILD_TARGET === 'electron'
)

const config = {
  // Static export ONLY for Electron, NOT for web/Vercel
  output: isElectronBuild ? 'export' : undefined,
  
  // Different output directories for Electron vs Web
  distDir: isElectronBuild && process.env.NODE_ENV === 'production' ? '../app' : '.next',
  
  // Only use trailing slash for Electron builds
  trailingSlash: isElectronBuild,
  
  images: {
    // Unoptimized images for Electron, optimized for web
    unoptimized: isElectronBuild,
  },
  
  // React strict mode for better development experience
  reactStrictMode: true,
  
  // Turbopack config (required for Next.js 16)
  turbopack: {},
}

console.log('📦 Next.js Build Config:', {
  isElectronBuild,
  isWebBuild,
  isVercel,
  output: config.output,
  distDir: config.distDir,
  trailingSlash: config.trailingSlash,
  imagesUnoptimized: config.images.unoptimized,
})

module.exports = config
