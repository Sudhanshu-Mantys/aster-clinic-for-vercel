/**
 * Quick test script for LifeTrenz token fetching
 * Run with: node test-liftrenz-token.js
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = 'config:aster-clinics:liftrenz-login-response';

if (!REDIS_URL) {
  console.error('❌ Error: REDIS_URL environment variable is not set');
  process.exit(1);
}

async function testToken() {
  console.log('🔌 Connecting to Redis...');

  const redis = new Redis(REDIS_URL, {
    tls: {
      rejectUnauthorized: false,
    },
  });

  redis.on('error', (error) => {
    console.error('❌ Redis error:', error);
  });

  try {
    console.log('📡 Fetching data from Redis key:', REDIS_KEY);
    const data = await redis.get(REDIS_KEY);

    if (!data) {
      console.error('❌ No data found in Redis');
      process.exit(1);
    }

    console.log('✅ Data found! Parsing...');
    const loginResponse = JSON.parse(data);

    console.log('\n📊 Response structure:');
    console.log('- success:', loginResponse.success);
    console.log('- message:', loginResponse.message);
    console.log('- status:', loginResponse.data?.status);
    console.log('- user:', loginResponse.data?.claims?.user?.userName);
    console.log('- passwordExpiresIn:', loginResponse.data?.passwordExpiresIn, 'days');

    if (loginResponse.data?.token?.jwt) {
      const jwt = loginResponse.data.token.jwt;
      console.log('\n🔑 JWT Token found!');
      console.log('- Preview:', jwt.substring(0, 50) + '...');
      console.log('- Length:', jwt.length, 'characters');
      console.log('- Issued at:', new Date(loginResponse.data.token.iat * 1000).toISOString());
      console.log('- Expires at:', new Date(loginResponse.data.token.exp * 1000).toISOString());

      // Check if expired
      const now = Date.now();
      const expiryTime = loginResponse.data.token.exp * 1000;
      const isExpired = now >= expiryTime;
      const timeRemaining = Math.floor((expiryTime - now) / 1000 / 60); // minutes

      console.log('\n⏰ Token status:');
      console.log('- Is expired:', isExpired);
      if (!isExpired) {
        console.log('- Time remaining:', timeRemaining, 'minutes');
      }

      console.log('\n✅ SUCCESS! Token can be used.');
    } else {
      console.error('❌ JWT token not found in response');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    redis.disconnect();
    console.log('\n👋 Disconnected from Redis');
  }
}

testToken();
