#!/usr/bin/env node
/**
 * AUTOMAGOTCHI Website System Test Suite
 * 
 * Tests all API endpoints and generates a report.
 * Run with: npx tsx scripts/test-systems.ts
 */

const BASE_URL = process.env.BASE_URL || 'https://automagotchi.cloud';
const TEST_AGENT_ID = process.env.TEST_AGENT_ID || '00000000-0000-0000-0000-000000000000';
const TEST_WALLET = process.env.TEST_WALLET || '5FHwkrdxUTMqMDjpE8FhTVzgKJiRLGHJQWEGKPGdKBBq';

interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'warn';
  statusCode: number;
  responseTime: number;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string, 
  endpoint: string, 
  method: string = 'GET',
  body?: any,
  expectedStatus: number = 200
): Promise<TestResult> {
  const url = `${BASE_URL}${endpoint}`;
  const start = Date.now();
  
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseTime = Date.now() - start;
    let data;
    
    try {
      data = await res.json();
    } catch {
      data = { raw: await res.text().catch(() => '(empty)') };
    }

    const status = res.status === expectedStatus ? 'pass' : 
                   res.status >= 400 && res.status < 500 ? 'warn' : 'fail';

    const result: TestResult = {
      name,
      endpoint,
      method,
      status,
      statusCode: res.status,
      responseTime,
      data: status !== 'pass' ? data : undefined,
    };

    if (status !== 'pass') {
      result.error = `Expected ${expectedStatus}, got ${res.status}`;
    }

    return result;
  } catch (err: any) {
    return {
      name,
      endpoint,
      method,
      status: 'fail',
      statusCode: 0,
      responseTime: Date.now() - start,
      error: err.message,
    };
  }
}

async function runTests() {
  console.log('\n🧪 AUTOMAGOTCHI SYSTEM TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // ═══════════════════════════════════════════════════════════
  // CORE API TESTS
  // ═══════════════════════════════════════════════════════════

  console.log('📡 Testing Core APIs...\n');

  // Activity Feed
  results.push(await testEndpoint(
    'Activity Feed',
    '/api/activity',
    'GET'
  ));

  // All Agents
  results.push(await testEndpoint(
    'All Agents List',
    '/api/agents/all',
    'GET'
  ));

  // On-Chain Agents
  results.push(await testEndpoint(
    'On-Chain Agents (ERC-8004)',
    '/api/agents/onchain',
    'GET'
  ));

  // Agent Discovery
  results.push(await testEndpoint(
    'Agent Discovery',
    '/api/agents/discover',
    'GET'
  ));

  // Agents by Owner
  results.push(await testEndpoint(
    'Agents by Owner',
    `/api/agents/owner?wallet=${TEST_WALLET}`,
    'GET'
  ));

  // Treasury Info
  results.push(await testEndpoint(
    'Treasury Info',
    '/api/treasury',
    'GET'
  ));

  // Credits Info
  results.push(await testEndpoint(
    'Credits System',
    '/api/credits',
    'GET'
  ));

  // Network Traffic
  results.push(await testEndpoint(
    'Network Traffic Stats',
    '/api/network/traffic',
    'GET'
  ));

  // Posts Feed
  results.push(await testEndpoint(
    'Social Posts Feed',
    '/api/posts',
    'GET'
  ));

  // ═══════════════════════════════════════════════════════════
  // AGENT-SPECIFIC TESTS (may 404 if test agent doesn't exist)
  // ═══════════════════════════════════════════════════════════

  console.log('\n🤖 Testing Agent-Specific Endpoints...\n');

  // Get specific agent
  results.push(await testEndpoint(
    'Get Agent by ID',
    `/api/agents/${TEST_AGENT_ID}`,
    'GET',
    undefined,
    200 // Will 404 if agent doesn't exist
  ));

  // Agent logs
  results.push(await testEndpoint(
    'Agent Logs',
    `/api/agents/${TEST_AGENT_ID}/logs`,
    'GET',
    undefined,
    200
  ));

  // Agent messages
  results.push(await testEndpoint(
    'Agent Messages',
    '/api/agents/messages',
    'GET'
  ));

  // ═══════════════════════════════════════════════════════════
  // INFRASTRUCTURE TESTS
  // ═══════════════════════════════════════════════════════════

  console.log('\n🏗️  Testing Infrastructure...\n');

  // Sandbox list
  results.push(await testEndpoint(
    'Sandbox List',
    '/api/sandbox',
    'GET'
  ));

  // Sandbox debug
  results.push(await testEndpoint(
    'Sandbox Debug Info',
    '/api/sandbox/debug',
    'GET'
  ));

  // ═══════════════════════════════════════════════════════════
  // GENERATE REPORT
  // ═══════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('═'.repeat(60) + '\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
    const time = `${r.responseTime}ms`.padStart(6);
    console.log(`${icon} [${r.statusCode}] ${time}  ${r.name}`);
    if (r.error) {
      console.log(`   └─ ${r.error}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Total: ${results.length} | ✅ Passed: ${passed} | ⚠️ Warnings: ${warned} | ❌ Failed: ${failed}`);
  
  const avgTime = Math.round(results.reduce((a, r) => a + r.responseTime, 0) / results.length);
  console.log(`Average Response Time: ${avgTime}ms`);
  console.log('─'.repeat(60) + '\n');

  // Return exit code based on failures
  return failed > 0 ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════
// Detailed Analysis Functions
// ═══════════════════════════════════════════════════════════

async function analyzePerformance() {
  console.log('\n⚡ PERFORMANCE ANALYSIS');
  console.log('═'.repeat(60));

  const slowEndpoints = results
    .filter(r => r.responseTime > 1000)
    .sort((a, b) => b.responseTime - a.responseTime);

  if (slowEndpoints.length > 0) {
    console.log('\n🐢 Slow Endpoints (>1s):');
    for (const ep of slowEndpoints) {
      console.log(`   ${ep.responseTime}ms - ${ep.endpoint}`);
    }
  } else {
    console.log('\n✅ All endpoints respond within 1s');
  }

  const p50 = results.map(r => r.responseTime).sort((a, b) => a - b)[Math.floor(results.length / 2)];
  const p95 = results.map(r => r.responseTime).sort((a, b) => a - b)[Math.floor(results.length * 0.95)];
  
  console.log(`\n📈 Percentiles: P50=${p50}ms, P95=${p95}ms`);
}

async function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      warnings: results.filter(r => r.status === 'warn').length,
    },
    performance: {
      avgResponseTime: Math.round(results.reduce((a, r) => a + r.responseTime, 0) / results.length),
      slowestEndpoint: results.reduce((a, b) => a.responseTime > b.responseTime ? a : b),
      fastestEndpoint: results.reduce((a, b) => a.responseTime < b.responseTime ? a : b),
    },
    results,
  };

  console.log('\n📄 JSON Report:');
  console.log(JSON.stringify(report, null, 2));

  return report;
}

// Main
(async () => {
  const exitCode = await runTests();
  await analyzePerformance();
  
  if (process.argv.includes('--json')) {
    await generateReport();
  }

  process.exit(exitCode);
})();
