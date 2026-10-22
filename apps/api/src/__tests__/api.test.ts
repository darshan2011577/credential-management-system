import request from 'supertest';
import { app } from '../app.js';

async function runTests() {
  console.log('\n--- Running Phase 4 REST API & Database Integration Automated Tests ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: GET /api/v1/health with Dependencies (Phase 4)
    console.log('[Test 1] Testing Primary Health Endpoint with MongoDB Atlas & Redis Dependencies...');
    const res1 = await request(app).get('/api/v1/health');
    assert(res1.status === 200, 'GET /api/v1/health returns HTTP 200 OK');
    assert(res1.body.success === true, 'Response body has success: true');
    assert(['healthy', 'degraded', 'unhealthy'].includes(res1.body.data.status), 'Response data has valid status ("healthy" | "degraded")');
    assert(Boolean(res1.body.data.dependencies), 'Response data contains "dependencies" object');
    assert(Boolean(res1.body.data.dependencies.mongodb), 'Response contains "dependencies.mongodb" object');
    assert(['connected', 'disconnected', 'connecting', 'error'].includes(res1.body.data.dependencies.mongodb.status), 'MongoDB status is a valid DependencyStatus');
    assert(Boolean(res1.body.data.dependencies.redis), 'Response contains "dependencies.redis" object');
    assert(['connected', 'disconnected', 'connecting', 'error'].includes(res1.body.data.dependencies.redis.status), 'Redis status is a valid DependencyStatus');
    assert(Boolean(res1.headers['x-request-id']), 'Response includes X-Request-ID header');

    // Test 2: Ensure sensitive credentials are NOT leaked in health response
    console.log('\n[Test 2] Testing Secret & Credential Leak Prevention in Health Payload...');
    const payloadStr = JSON.stringify(res1.body);
    assert(!payloadStr.includes('mongodb+srv://'), 'Health response does NOT leak raw MongoDB Atlas URI');
    assert(!payloadStr.includes('SJG4Hgo5nG6yhZ4J'), 'Health response does NOT leak MongoDB Atlas password');

    // Test 3: GET /api/health (Compatibility Alias)
    console.log('\n[Test 3] Testing Compatibility Alias Endpoint (GET /api/health)...');
    const res2 = await request(app).get('/api/health');
    assert(res2.status === 200, 'GET /api/health returns HTTP 200 OK');
    assert(res2.body.success === true, 'Compatibility response body has success: true');
    assert(Boolean(res2.body.data.dependencies), 'Compatibility response has dependencies object');

    // Test 4: Unknown Route 404 Handling
    console.log('\n[Test 4] Testing 404 Route Not Found Handling (GET /api/v1/invalid-route)...');
    const res3 = await request(app).get('/api/v1/invalid-route');
    assert(res3.status === 404, 'Unknown route returns HTTP 404 Not Found');
    assert(res3.body.success === false, '404 response body has success: false');
    assert(res3.body.error.code === 'ROUTE_NOT_FOUND', '404 error code is "ROUTE_NOT_FOUND"');
    assert(Boolean(res3.body.error.message), '404 response includes a user-friendly message');
    assert(Boolean(res3.headers['x-request-id']), '404 response includes X-Request-ID header');

    // Test 5: Security Headers
    console.log('\n[Test 5] Testing Security Headers (Helmet)...');
    assert(res1.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header is present');

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with error:', error);
    process.exit(1);
  }
}

runTests();

