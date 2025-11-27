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
  // No static export - keep Next.js server running for API routes (CORS proxy)
  // output: undefined (default)
  
  // Use standard .next directory
  distDir: '.next',
  
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
  distDir: config.distDir,
  imagesUnoptimized: config.images.unoptimized,
  note: 'Next.js server mode - API routes enabled',
})

module.exports = config
