/** @type {import('next').NextConfig} */

// Detect if we're building for Electron or Web
const isElectronBuild = process.env.npm_lifecycle_event === 'dev' || 
                        process.env.npm_lifecycle_event === 'build' ||
                        process.env.BUILD_TARGET === 'electron'

const isWebBuild = process.env.npm_lifecycle_event === 'dev:web' || 
                   process.env.npm_lifecycle_event === 'build:web' ||
                   process.env.BUILD_TARGET === 'web'

const config = {
  // Static export for Electron, standard build for web
  output: isElectronBuild ? 'export' : undefined,
  
  // Different output directories for Electron vs Web
  distDir: isElectronBuild && process.env.NODE_ENV === 'production' ? '../app' : '.next',
  
  trailingSlash: true,
  
  images: {
    // Unoptimized images for Electron, optimized for web
    unoptimized: isElectronBuild,
  },
  
  webpack: (config) => {
    return config
  },
  
  turbopack: {},
  
  // Enable SWC minification for better performance
  swcMinify: true,
  
  // React strict mode for better development experience
  reactStrictMode: true,
}

console.log('📦 Next.js Build Config:', {
  isElectronBuild,
  isWebBuild,
  output: config.output,
  distDir: config.distDir,
  imagesUnoptimized: config.images.unoptimized,
})

module.exports = config
