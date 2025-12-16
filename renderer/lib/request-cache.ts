/**
 * Simple request cache to prevent duplicate simultaneous API calls
 */

interface CachedRequest {
    promise: Promise<any>;
    timestamp: number;
}

const requestCache = new Map<string, CachedRequest>();
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Get a cached request or create a new one
 * This prevents duplicate simultaneous requests for the same URL
 */
export async function cachedFetch(
    url: string,
    options?: RequestInit
): Promise<Response> {
    const cacheKey = `${url}_${JSON.stringify(options || {})}`;
    const cached = requestCache.get(cacheKey);

    // If we have a recent cached request (within 5 seconds), reuse it
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.promise.then((response) => {
            // Clone the response so it can be read multiple times
            // Check if the response body is still available before cloning
            if (response.bodyUsed) {
                // If body is already used, we can't clone, so make a new request
                requestCache.delete(cacheKey);
                return cachedFetch(url, options);
            }
            return response.clone();
        });
    }

    // Create new request
    // We need to cache the original response and always return clones
    const fetchPromise = fetch(url, options);

    // Create a promise that resolves to a clone for the caller
    const promise = fetchPromise.then((response) => {
        // Clone immediately so the original can be cached and reused
        return response.clone();
    });

    // Cache a promise that resolves to the original response (never consumed)
    const cachePromise = fetchPromise.then((response) => {
        // Remove from cache after a short delay
        setTimeout(() => {
            requestCache.delete(cacheKey);
        }, CACHE_DURATION);
        // Return the original response for caching (never directly returned to callers)
        return response;
    });

    // Cache the promise that resolves to the original response (never consumed)
    requestCache.set(cacheKey, {
        promise: cachePromise,
        timestamp: Date.now(),
    });

    // Return a clone to the caller
    return promise;
}

/**
 * Clear the request cache (useful for testing or forced refreshes)
 */
export function clearRequestCache(): void {
    requestCache.clear();
}

/**
 * Fetch with timeout
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 */
export async function fetchWithTimeout(
    url: string,
    options?: RequestInit,
    timeoutMs: number = 5000
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}

