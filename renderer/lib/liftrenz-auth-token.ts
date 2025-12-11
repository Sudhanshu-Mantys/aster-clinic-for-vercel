/**
 * LifeTrenz Authentication Token Management
 * Fetches the JWT token from Redis for authenticating LifeTrenz API requests
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = 'config:aster-clinics:liftrenz-login-response';

if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not set');
}

// Singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      tls: {
        rejectUnauthorized: false,
      },
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (error) => {
      console.error('Redis connection error:', error);
    });
  }
  return redisClient;
}

/**
 * Interface for the LifeTrenz login response stored in Redis
 */
interface LifeTrenzLoginResponse {
  success: boolean;
  message: string;
  data: {
    status: string;
    passwordExpiresIn: number;
    hasMfa: boolean;
    mfaIdentifier: string;
    claims: {
      user: {
        id: number;
        name: {
          firstName: string;
          lastName: string;
        };
        userName: string;
        contactEmail: string;
        usercontactNo: string;
      };
      userRole: {
        id: number;
        name: string;
        hasMfa: boolean;
      };
      status: string;
      customerId: number;
      productId: number;
    };
    userSites: Array<{
      site: {
        id: number;
        name: string;
        alias: string;
      };
      isDefault: boolean;
      hasAccess: boolean;
    }>;
    token: {
      typ: string;
      jwt: string;
      iat: number;
      exp: number;
    };
  };
}

/**
 * Fetch the LifeTrenz JWT token from Redis
 * @returns The JWT token string
 * @throws Error if token cannot be fetched or parsed
 */
export async function getLifeTrenzAuthToken(): Promise<string> {
  try {
    const redis = getRedisClient();
    const data = await redis.get(REDIS_KEY);

    if (!data) {
      throw new Error('LifeTrenz login response not found in Redis');
    }

    const loginResponse: LifeTrenzLoginResponse = JSON.parse(data);

    if (!loginResponse.success) {
      throw new Error('LifeTrenz login response indicates failure');
    }

    if (!loginResponse.data?.token?.jwt) {
      throw new Error('JWT token not found in LifeTrenz login response');
    }

    return loginResponse.data.token.jwt;
  } catch (error) {
    console.error('Error fetching LifeTrenz auth token from Redis:', error);
    throw error;
  }
}

/**
 * Get the Authorization header value for LifeTrenz API requests
 * @returns The formatted Bearer token
 */
export async function getLifeTrenzAuthorizationHeader(): Promise<string> {
  const token = await getLifeTrenzAuthToken();
  return `Bearer ${token}`;
}

/**
 * Check if the token is expired or about to expire
 * @param bufferMinutes - Number of minutes before expiry to consider token expired (default: 5)
 * @returns true if token is expired or about to expire
 */
export async function isLifeTrenzTokenExpired(bufferMinutes: number = 5): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const data = await redis.get(REDIS_KEY);

    if (!data) {
      return true;
    }

    const loginResponse: LifeTrenzLoginResponse = JSON.parse(data);

    if (!loginResponse.data?.token?.exp) {
      return true;
    }

    const expiryTime = loginResponse.data.token.exp * 1000; // Convert to milliseconds
    const bufferTime = bufferMinutes * 60 * 1000;
    const now = Date.now();

    return now >= (expiryTime - bufferTime);
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true; // Assume expired on error
  }
}

/**
 * Close the Redis connection
 * Call this when shutting down the application
 */
export function closeRedisConnection(): void {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}
