/**
 * Test the LifeTrenz token utilities directly
 * Run with: node test-liftrenz-api.mjs
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = 'config:aster-clinics:liftrenz-login-response';

if (!REDIS_URL) {
  console.error('❌ Error: REDIS_URL environment variable is not set');
  process.exit(1);
}

async function getLifeTrenzAuthToken() {
  const redis = new Redis(REDIS_URL, {
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    const data = await redis.get(REDIS_KEY);
    if (!data) {
      throw new Error('LifeTrenz login response not found in Redis');
    }

    const loginResponse = JSON.parse(data);

    if (!loginResponse.success) {
      throw new Error('LifeTrenz login response indicates failure');
    }

    if (!loginResponse.data?.token?.jwt) {
      throw new Error('JWT token not found in LifeTrenz login response');
    }

    return loginResponse.data.token.jwt;
  } finally {
    redis.disconnect();
  }
}

async function testAPI() {
  console.log('🧪 Testing LifeTrenz Auth Token Functions\n');

  try {
    console.log('1️⃣ Fetching token from Redis...');
    const token = await getLifeTrenzAuthToken();
    console.log('   ✅ Token retrieved successfully');
    console.log('   📝 Token preview:', token.substring(0, 50) + '...\n');

    console.log('2️⃣ Creating Authorization header...');
    const authHeader = `Bearer ${token}`;
    console.log('   ✅ Header created:', authHeader.substring(0, 60) + '...\n');

    console.log('3️⃣ Token can now be used in API calls like:');
    console.log('   fetch(url, {');
    console.log('     headers: {');
    console.log(`       'Authorization': '${authHeader.substring(0, 50)}...',`);
    console.log("       'Content-Type': 'application/json'");
    console.log('     }');
    console.log('   })\n');

    console.log('✅ ALL TESTS PASSED!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAPI();
