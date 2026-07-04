import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../.env');

// Simple .env loader
if (fs.existsSync(ENV_PATH)) {
  const envFile = fs.readFileSync(ENV_PATH, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
}

async function discoverOpenRouter() {
  console.log('\n--- 🌐 Discovering OpenRouter Models ---');
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    
    // Filter free models
    const freeModels = data.data.filter((m: any) => 
      m.pricing?.prompt === '0' || m.pricing?.prompt === 0 || m.id.endsWith(':free')
    );
    
    console.log(`Found ${data.data.length} total models. ${freeModels.length} are FREE.`);
    console.log('Detailed sample of one FREE model:');
    if (freeModels.length > 0) {
      console.log(JSON.stringify(freeModels[0], null, 2));
    }
  } catch (err) {
    console.error('OpenRouter discovery failed:', err);
  }
}

async function discoverGroq() {
  console.log('\n--- ⚡ Discovering Groq Models ---');
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.log('⚠️  Skipping Groq: GROQ_API_KEY not found in .env');
    return;
  }
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    
    console.log(`Found ${data.data?.length} total models.`);
    data.data?.slice(0, 5).forEach((m: any) => {
      console.log(` - ${m.id} (Context: ${m.context_window})`);
    });
  } catch (err) {
    console.error('Groq discovery failed:', err);
  }
}

async function discoverNvidia() {
  console.log('\n--- 🟢 Discovering NVIDIA NIM Models ---');
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    console.log('⚠️  Skipping NVIDIA: NVIDIA_API_KEY not found in .env');
    return;
  }
  
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    
    console.log(`Found ${data.data?.length} total models.`);
    console.log('Detailed sample of one NVIDIA model:');
    if (data.data?.length > 0) {
      console.log(JSON.stringify(data.data[0], null, 2));
    }
  } catch (err) {
    console.error('NVIDIA discovery failed:', err);
  }
}

async function main() {
  console.log('Starting dynamic model discovery...');
  await discoverOpenRouter();
  await discoverGroq();
  await discoverNvidia();
  console.log('\nDiscovery test complete.');
}

main();