/**
 * Environment detection utilities
 * Helps determine if the app is running in Electron or Web browser
 */

export const isElectron = (): boolean => {
    // Check if running in Electron environment
    if (typeof window !== 'undefined' && typeof window.process === 'object') {
        return true
    }

    // Check for electron in user agent
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true
    }

    return false
}

export const isWeb = (): boolean => {
    return !isElectron()
}

export const getEnvironment = (): 'electron' | 'web' => {
    return isElectron() ? 'electron' : 'web'
}

// Platform detection
export const getPlatform = (): 'darwin' | 'win32' | 'linux' | 'web' => {
    if (isWeb()) return 'web'

    if (typeof process !== 'undefined' && process.platform) {
        return process.platform as 'darwin' | 'win32' | 'linux'
    }

    return 'web'
}

// Check if we have access to Electron APIs
export const hasElectronAPI = (): boolean => {
    return typeof window !== 'undefined' && !!(window as any).electron
}

