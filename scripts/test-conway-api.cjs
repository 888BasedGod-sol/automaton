const fs = require('fs');
const configPath = process.env.HOME + '/.automaton/config.json';

if (!fs.existsSync(configPath)) {
  console.log('No config found at', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const apiUrl = config.conwayApiUrl || 'https://api.conway.tech';
const socialUrl = config.socialRelayUrl || 'https://social.conway.tech';
const apiKey = config.apiKey;

console.log('API URL:', apiUrl);
console.log('Social URL:', socialUrl);
console.log('Has API Key:', !!apiKey);
console.log('');

// Test endpoints that should work with API key
const endpoints = [
  { url: apiUrl + '/v1/credits/balance', name: 'Conway credits/balance', auth: true },
  { url: apiUrl + '/v1/sandboxes', name: 'Conway sandboxes', auth: true },
  { url: apiUrl + '/health', name: 'Conway health', auth: false },
  { url: apiUrl + '/', name: 'Conway root', auth: false },
];

async function test() {
  for (const ep of endpoints) {
    try {
      const headers = {};
      if (ep.auth && apiKey) headers['Authorization'] = apiKey;
      
      const res = await fetch(ep.url, { headers });
      const text = await res.text();
      console.log(`${ep.name}: ${res.status}`);
      if (res.ok) {
        try {
          const json = JSON.parse(text);
          console.log('  →', JSON.stringify(json).substring(0, 200));
        } catch {
          console.log('  →', text.substring(0, 200));
        }
      }
    } catch (e) {
      console.log(`${ep.name}: ERROR - ${e.message}`);
    }
    console.log('');
  }
}

test();
