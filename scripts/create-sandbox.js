/**
 * Create Conway Sandbox
 * 
 * Registers a new sandbox with Conway's API to host the automaton.
 * Requires CONWAY_API_KEY environment variable.
 */

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY;

async function createSandbox() {
  if (!CONWAY_API_KEY) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          POST /v1/sandboxes - CREATE SANDBOX               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('❌ Missing CONWAY_API_KEY environment variable');
    console.log('');
    console.log('To create a sandbox, you need a Conway API key:');
    console.log('');
    console.log('  1. Sign up at https://conway.tech');
    console.log('  2. Go to Settings → API Keys');
    console.log('  3. Create a new API key');
    console.log('  4. Run:');
    console.log('');
    console.log('     CONWAY_API_KEY=your_key_here node scripts/create-sandbox.js');
    console.log('');
    console.log('Or set it permanently:');
    console.log('');
    console.log('     echo "CONWAY_API_KEY=your_key_here" >> .env');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    return;
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          POST /v1/sandboxes - CREATE SANDBOX               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`API URL: ${CONWAY_API_URL}`);
  console.log('Creating sandbox...');
  console.log('');

  try {
    const response = await fetch(`${CONWAY_API_URL}/v1/sandboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': CONWAY_API_KEY,
      },
      body: JSON.stringify({
        name: 'automaton-' + Date.now(),
        vcpu: 1,
        memory_mb: 512,
        disk_gb: 5,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(`❌ Error: ${response.status} ${response.statusText}`);
      console.log(text);
      return;
    }

    const sandbox = await response.json();
    
    console.log('✅ Sandbox created successfully!');
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  SANDBOX DETAILS                                           │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  ID:       ${sandbox.id || sandbox.sandbox_id}`);
    console.log(`│  Status:   ${sandbox.status}`);
    console.log(`│  Region:   ${sandbox.region || 'default'}`);
    console.log(`│  vCPU:     ${sandbox.vcpu}`);
    console.log(`│  Memory:   ${sandbox.memory_mb}MB`);
    console.log(`│  Disk:     ${sandbox.disk_gb}GB`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // Update identity.json with new sandbox ID
    const fs = await import('fs');
    const identityPath = 'data/identity.json';
    
    if (fs.existsSync(identityPath)) {
      const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
      identity.sandboxId = sandbox.id || sandbox.sandbox_id;
      fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2));
      console.log('✅ Updated data/identity.json with sandbox ID');
    }
    
    console.log('');
    console.log('Next steps:');
    console.log('  1. Export your API key: export CONWAY_API_KEY=your_key');
    console.log('  2. Run the agent: node dist/index.js --run');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    console.log('');
    console.log('Check your network connection and API key.');
  }
}

createSandbox();
