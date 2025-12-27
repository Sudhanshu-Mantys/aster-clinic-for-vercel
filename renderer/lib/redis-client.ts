/**
 * Redis Client Utility
 * Provides a Redis client for server-side usage using ioredis
 */

import Redis from 'ioredis'

let redisClient: Redis | null = null
let isConnecting = false

/**
 * Get or create Redis client
 */
export async function getRedisClient(): Promise<Redis> {
    if (redisClient && redisClient.status === 'ready') {
        return redisClient
    }

    if (isConnecting) {
        // Wait for the connection to complete
        await new Promise(resolve => setTimeout(resolve, 100))
        return getRedisClient()
    }

    isConnecting = true

    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

        redisClient = new Redis(redisUrl, {
            tls: {
                rejectUnauthorized: false,
            },
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 10) {
                    console.error('Redis: Too many retry attempts')
                    return null
                }
                return Math.min(times * 50, 500)
            },
            reconnectOnError: (err) => {
                const targetError = 'READONLY'
                if (err.message.includes(targetError)) {
                    // Only reconnect when the error contains "READONLY"
                    return true
                }
                return false
            },
            connectTimeout: 5000, // 5 second connection timeout
            commandTimeout: 5000, // 5 second timeout for individual commands
        })

        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err)
        })

        redisClient.on('connect', () => {
            console.log('✅ Redis connected successfully')
        })

        redisClient.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...')
        })

        redisClient.on('ready', () => {
            console.log('✅ Redis client ready')
            isConnecting = false
        })

        // Wait for connection to be ready
        if (redisClient.status !== 'ready') {
            await new Promise((resolve, reject) => {
                redisClient!.once('ready', resolve)
                redisClient!.once('error', reject)
                // Timeout after 5 seconds
                setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
            })
        }

        isConnecting = false
        return redisClient
    } catch (error) {
        isConnecting = false
        console.error('Failed to connect to Redis:', error)
        throw error
    }
}

/**
 * Close Redis connection
 */
export async function closeRedisClient() {
    if (redisClient) {
        await redisClient.quit()
        redisClient = null
    }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
    try {
        const client = await getRedisClient()
        await client.ping()
        return true
    } catch (error) {
        console.error('Redis is not available:', error)
        return false
    }
}
