const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const projectDir = __dirname;
const { server, db, computeMatch, getAllSchemeRows, getSchemeById } = require(path.join(projectDir, 'server.js'));

async function runTests() {
  console.log('=== STARTING GOVERNMENT SCHEME MATCHER TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. FRONTEND STATIC & DOM ELEMENT INTEGRITY TEST
  await test('Frontend HTML & DOM Element IDs Integrity', () => {
    const html = fs.readFileSync(path.join(projectDir, 'public', 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(projectDir, 'public', 'app.js'), 'utf8');

    // Extract all getElementById calls
    const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
    let match;
    const requiredIds = new Set();
    while ((match = idRegex.exec(js)) !== null) {
      requiredIds.add(match[1]);
    }

    console.log(`   Checking ${requiredIds.size} element IDs referenced in app.js...`);
    const missingIds = [];
    for (const id of requiredIds) {
      if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      throw new Error(`Missing element IDs in index.html: ${missingIds.join(', ')}`);
    }
  });

  // 2. SERVER STARTUP ON TEST PORT
  const TEST_PORT = 3126;
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  console.log(`   Test server listening on port ${TEST_PORT}`);

  function request(method, pathUrl, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        ...headers,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      };

      const req = http.request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: pathUrl,
        method,
        headers: reqHeaders,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch(e) {}
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // 3. STATIC FILE SERVING
  await test('GET / serves index.html', async () => {
    const res = await request('GET', '/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Scheme Matcher'));
  });

  await test('GET /style.css and /app.js serve static assets', async () => {
    const css = await request('GET', '/style.css');
    assert.strictEqual(css.status, 200);
    const js = await request('GET', '/app.js');
    assert.strictEqual(js.status, 200);
  });

  // 4. CONFIG & REFERENCE DATA
  await test('GET /api/config returns safe config', async () => {
    const res = await request('GET', '/api/config');
    assert.strictEqual(res.status, 200);
    assert.ok('googleClientId' in res.json);
  });

  await test('GET /api/domains returns welfare domains', async () => {
    const res = await request('GET', '/api/domains');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.length >= 8);
  });

  await test('GET /api/states returns Indian states list', async () => {
    const res = await request('GET', '/api/states');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.includes('Uttar Pradesh'));
  });

  await test('GET /api/stats returns statistics', async () => {
    const res = await request('GET', '/api/stats');
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.totalSchemes >= 30);
  });

  await test('GET /api/schemes returns scheme records', async () => {
    const res = await request('GET', '/api/schemes');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.length >= 30);
  });

  // 5. DETERMINISTIC MATCHING ENGINE
  await test('POST /api/match deterministic matching and explainable scoring', async () => {
    // NMMS matching criteria: School education, income <= 150000, age 13-16
    const res = await request('POST', '/api/match', {
      answers: {
        state: 'Uttar Pradesh',
        category: 'All',
        gender: 'Male',
        age: '14',
        income: '120000',
        disability: 'no',
        occupation: 'Student',
        education: 'School',
        domain: 'education'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.json.count > 0);
    const nmms = res.json.results.find(s => s.id === 'S001');
    assert.ok(nmms, 'NMMS should match for school student');
    assert.strictEqual(nmms.score, 100, 'NMMS should have 100% score for exact match');
    assert.strictEqual(nmms.isFullyEligible, true);
    assert.ok(nmms.reasons.length > 0, 'Must have explainable reasons');
    assert.strictEqual(nmms.missing.length, 0, 'No missing requirements for full match');

    // Partial match test: Age 28, Income 500000 -> Should show missing requirements
    const resPartial = await request('POST', '/api/match', {
      answers: {
        state: 'Delhi',
        category: 'General',
        gender: 'Female',
        age: '28',
        income: '500000',
        disability: 'no',
        occupation: 'Student',
        education: 'UG'
      }
    });
    assert.strictEqual(resPartial.status, 200);
    const partialMatch = resPartial.json.results.find(s => s.missing && s.missing.length > 0);
    assert.ok(partialMatch, 'Should have schemes with explainable missing criteria');
    assert.ok(partialMatch.missing.length > 0);
  });

  // 6. ANONYMOUS BOOKMARKS
  const testDeviceId = 'DEV-TEST-' + Date.now();
  await test('Anonymous Bookmarks creation and retrieval with X-Device-Id', async () => {
    // Add bookmark
    const addRes = await request('POST', '/api/bookmarks/S001', null, { 'X-Device-Id': testDeviceId });
    assert.strictEqual(addRes.status, 200);
    assert.strictEqual(addRes.json.bookmarked, true);

    // Retrieve
    const getRes = await request('GET', '/api/bookmarks', null, { 'X-Device-Id': testDeviceId });
    assert.strictEqual(getRes.status, 200);
    assert.ok(getRes.json.includes('S001'));

    // Toggle off
    const removeRes = await request('POST', '/api/bookmarks/S001', null, { 'X-Device-Id': testDeviceId });
    assert.strictEqual(removeRes.status, 200);
    assert.strictEqual(removeRes.json.bookmarked, false);
  });

  // 7. ADMIN AUTH & PROTECTED ENDPOINTS
  let adminToken = '';
  await test('Admin login with invalid password rejects (401)', async () => {
    const res = await request('POST', '/api/admin/login', { password: 'wrongpassword' });
    assert.strictEqual(res.status, 401);
  });

  await test('Admin login with valid password succeeds and issues token', async () => {
    const res = await request('POST', '/api/admin/login', { password: 'admin123' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    adminToken = res.json.token;
  });

  await test('Admin protected audit log endpoint requires admin token', async () => {
    const unauth = await request('GET', '/api/admin/audit-log');
    assert.strictEqual(unauth.status, 401);

    const auth = await request('GET', '/api/admin/audit-log', null, { 'Authorization': `Bearer ${adminToken}` });
    assert.strictEqual(auth.status, 200);
    assert.ok(Array.isArray(auth.json));
  });

  // 8. GOOGLE AUTH ENDPOINT VALIDATION
  await test('POST /api/auth/google rejects invalid / forged ID token gracefully', async () => {
    const res = await request('POST', '/api/auth/google', { credential: 'invalid.forged.token' });
    assert.strictEqual(res.status, 401);
  });

  // 9. STUDENT LOCAL AUTH / DEV LOGIN & SESSIONS
  let studentToken = '';
  let studentId = '';
  await test('POST /api/auth/dev-login creates student session & migrates device bookmarks', async () => {
    // Seed a device bookmark first
    await request('POST', '/api/bookmarks/S002', null, { 'X-Device-Id': testDeviceId });

    const res = await request('POST', '/api/auth/dev-login', {
      email: 'aarav.student@test.local',
      name: 'Aarav Sharma'
    }, { 'X-Device-Id': testDeviceId });

    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    studentToken = res.json.token;
    studentId = res.json.user.id;

    // Verify authenticated bookmarks contain migrated S002
    const bmRes = await request('GET', '/api/bookmarks', null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(bmRes.status, 200);
    assert.ok(bmRes.json.includes('S002'), 'Device bookmark must migrate to student account upon login');
  });

  // 10. PROFILE PERSISTENCE
  await test('Student Profile PUT and GET persistence', async () => {
    const updateRes = await request('PUT', '/api/profile', {
      state: 'Karnataka',
      category: 'OBC',
      gender: 'Male',
      age: 22,
      income: 200000,
      education: 'UG',
      occupation: 'Student',
      domain: 'education'
    }, { 'Authorization': `Bearer ${studentToken}` });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.json.state, 'Karnataka');

    const getRes = await request('GET', '/api/profile', null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.json.category, 'OBC');
    assert.strictEqual(getRes.json.age, 22);
  });

  // 11. APPLICATION TRACKER LIFECYCLE
  let createdAppId = '';
  await test('Application Tracker: Create, Read, Update, Delete', async () => {
    // Create application
    const createRes = await request('POST', '/api/applications', {
      scheme_id: 'S001',
      status: 'Preparing',
      notes: 'Submitted school verification form'
    }, { 'Authorization': `Bearer ${studentToken}` });

    assert.strictEqual(createRes.status, 201);
    createdAppId = createRes.json.id;

    // Read applications
    const listRes = await request('GET', '/api/applications', null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(listRes.status, 200);
    const found = listRes.json.find(a => a.id === createdAppId);
    assert.ok(found);
    assert.strictEqual(found.scheme_name, 'National Means-cum-Merit Scholarship (NMMS)');

    // Update application status
    const updateRes = await request('PUT', `/api/applications/${createdAppId}`, {
      status: 'Under Review',
      notes: 'School approved, forwarded to District'
    }, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.json.status, 'Under Review');

    // Delete application
    const delRes = await request('DELETE', `/api/applications/${createdAppId}`, null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(delRes.status, 200);
  });

  // 12. DOCUMENT VAULT (GENUINE STORAGE & METADATA)
  let createdDocId = '';
  await test('Document Vault: Upload validation, retrieval, and deletion', async () => {
    // Reject invalid mime type
    const badMime = await request('POST', '/api/documents', {
      docType: 'Aadhaar',
      fileName: 'malicious.exe',
      fileBase64: Buffer.from('dummy').toString('base64'),
      mimeType: 'application/x-msdownload'
    }, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(badMime.status, 400);

    // Accept valid PDF
    const dummyPdf = Buffer.from('%PDF-1.4 test document content for scheme matcher').toString('base64');
    const uploadRes = await request('POST', '/api/documents', {
      docType: 'Aadhaar',
      fileName: 'aadhaar_card.pdf',
      fileBase64: dummyPdf,
      mimeType: 'application/pdf'
    }, { 'Authorization': `Bearer ${studentToken}` });

    assert.strictEqual(uploadRes.status, 201);
    createdDocId = uploadRes.json.id;

    // Retrieve documents list
    const listRes = await request('GET', '/api/documents', null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.json.some(d => d.id === createdDocId));

    // Download document
    const dlRes = await request('GET', `/api/documents/${createdDocId}/download`, null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(dlRes.status, 200);
    assert.strictEqual(dlRes.headers['content-type'], 'application/pdf');

    // Delete document
    const delRes = await request('DELETE', `/api/documents/${createdDocId}`, null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(delRes.status, 200);
  });

  // 13. NOTIFICATIONS RETRIEVAL & READ STATUS
  await test('Notifications API retrieval and mark as read', async () => {
    const listRes = await request('GET', '/api/notifications', null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.json));
    assert.ok(listRes.json.length > 0, 'Welcome notification should exist');

    const notifId = listRes.json[0].id;
    const readRes = await request('POST', `/api/notifications/${notifId}/read`, null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(readRes.status, 200);
  });

  // 14. SERVICE REQUESTS (DONATION & VOLUNTEER)
  await test('POST /api/service-requests (Donation pledge and volunteer registration)', async () => {
    // Donation intent
    const donRes = await request('POST', '/api/service-requests', {
      type: 'donation',
      amount: 2500,
      name: 'Rohan Gupta',
      email: 'rohan@example.com',
      pan: 'ABCDE1234F',
      message: 'Keep supporting rural students!'
    }, { 'Authorization': `Bearer ${studentToken}` });

    assert.strictEqual(donRes.status, 201);
    assert.strictEqual(donRes.json.status, 'pledged');

    // Volunteer registration
    const volRes = await request('POST', '/api/service-requests', {
      type: 'volunteer',
      name: 'Sneha Patel',
      email: 'sneha@example.com',
      interests: 'Application Assistance',
      availability: '3-5 hours/week'
    });
    assert.strictEqual(volRes.status, 201);
    assert.strictEqual(volRes.json.status, 'registered');
  });

  // 15. FEEDBACK SUBMISSION
  await test('POST /api/feedback saves rating and comments', async () => {
    const fbRes = await request('POST', '/api/feedback', {
      rating: 5,
      message: 'Excellent platform, found two scholarships I qualified for!'
    }, { 'Authorization': `Bearer ${studentToken}` });

    assert.strictEqual(fbRes.status, 201);
    assert.strictEqual(fbRes.json.success, true);
  });

  // 16. EXTENDED ADMIN PANELS (USERS, APPLICATIONS, REQUESTS, FEEDBACK)
  await test('Admin views users, applications, service requests, and feedback', async () => {
    const users = await request('GET', '/api/admin/users', null, { 'Authorization': `Bearer ${adminToken}` });
    assert.strictEqual(users.status, 200);
    assert.ok(users.json.some(u => u.id === studentId));

    const reqs = await request('GET', '/api/admin/service-requests', null, { 'Authorization': `Bearer ${adminToken}` });
    assert.strictEqual(reqs.status, 200);
    assert.ok(reqs.json.length >= 2);

    const fbs = await request('GET', '/api/admin/feedback', null, { 'Authorization': `Bearer ${adminToken}` });
    assert.strictEqual(fbs.status, 200);
    assert.ok(fbs.json.length >= 1);
  });

  // 17. AI CHAT ASSISTANT & VOICE GUIDANCE ENDPOINT
  await test('POST /api/ai-chat: Assistant answers scheme questions & navigational commands', async () => {
    // Test 1: Guided tour navigation action
    const resTour = await request('POST', '/api/ai-chat', { message: 'Start guided tour' });
    assert.strictEqual(resTour.status, 200);
    assert.strictEqual(resTour.json.action, 'START_TOUR');
    assert.ok(resTour.json.voiceText, 'Must include voiceText for speech synthesis');
    assert.ok(Array.isArray(resTour.json.chips), 'Must return quick prompt chips');

    // Test 2: Document guidance
    const resDocs = await request('POST', '/api/ai-chat', { message: 'What documents are required for NSP?' });
    assert.strictEqual(resDocs.status, 200);
    assert.ok(resDocs.json.reply.includes('Aadhaar') || resDocs.json.reply.includes('Income'), 'Must list required documents');

    // Test 3: Modal action dispatch
    const resVault = await request('POST', '/api/ai-chat', { message: 'Open my document vault' });
    assert.strictEqual(resVault.status, 200);
    assert.strictEqual(resVault.json.action, 'OPEN_MODAL');
    assert.strictEqual(resVault.json.target, 'vault-modal');
  });

  // 18. PERSISTENCE SURVIVES RESTART
  await test('Database persistence survives restart', async () => {
    const markerId = 'TEST_PERSIST_' + Date.now();
    db.prepare('INSERT INTO feedback (id, rating, message, created_at) VALUES (?, ?, ?, ?)').run(
      markerId, 5, 'Persistence verification marker', new Date().toISOString()
    );

    const { DatabaseSync } = require('node:sqlite');
    const freshDb = new DatabaseSync(path.join(projectDir, 'data', 'scheme-matcher.db'));
    const row = freshDb.prepare('SELECT * FROM feedback WHERE id = ?').get(markerId);
    assert.ok(row, 'Marker record must exist in freshly opened database connection');
    freshDb.prepare('DELETE FROM feedback WHERE id = ?').run(markerId);
  });

  // Close server
  await new Promise(resolve => server.close(resolve));

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner crash:', err);
  process.exit(1);
});
