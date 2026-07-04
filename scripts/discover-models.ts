import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../.env');

// Simple .env loader
if (fsSync.existsSync(ENV_PATH)) {
  const envFile = fsSync.readFileSync(ENV_PATH, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
}

/**
 * Reads the OKF profile, updates the provider_config.models block, and saves it.
 */
async function updateProfileModels(adapterId: string, modelsDict: Record<string, any>) {
  const filePath = path.resolve(__dirname, `../.knowledge/adapters/${adapterId}.md`);
  const content = await fs.readFile(filePath, 'utf-8');
  
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`No frontmatter in ${adapterId}.md`);
  
  const frontmatter = match[1];
  const parsed = yaml.load(frontmatter) as any;
  
  // Overwrite models with fresh data
  if (!parsed.provider_config) parsed.provider_config = {};
  parsed.provider_config.models = modelsDict;
  
  const newFrontmatter = yaml.dump(parsed, { lineWidth: -1 });
  const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${newFrontmatter}---`);
  
  await fs.writeFile(filePath, newContent, 'utf-8');
  console.log(`✅ Updated ${adapterId}.md with ${Object.keys(modelsDict).length} fresh models.`);
}

async function discoverOpenRouter() {
  console.log('\n--- 🌐 Discovering OpenRouter Free Models ---');
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    
    // Filter free models
    const freeModels = data.data.filter((m: any) => 
      m.pricing?.prompt === '0' || m.pricing?.prompt === 0 || m.id.endsWith(':free')
    );
    
    const modelsDict: Record<string, any> = {};
    for (const m of freeModels) {
      modelsDict[m.id] = {
        description: m.name || m.id,
        context_window: m.context_length || 8192,
        max_output_tokens: m.top_provider?.max_completion_tokens || 4096,
        pricing: { input_per_1m: 0, output_per_1m: 0 }
      };
    }
    
    await updateProfileModels('openrouter', modelsDict);
  } catch (err) {
    console.error('OpenRouter discovery failed:', err);
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
    
    const modelsDict: Record<string, any> = {};
    // Taking the list from the API. The OpenAI-compatible endpoint doesn't give us 
    // context window, so we apply a safe default.
    for (const m of data.data) {
      modelsDict[m.id] = {
        description: `NVIDIA NIM: ${m.id}`,
        context_window: 8192, // Safe fallback
        max_output_tokens: 4096,
        pricing: { input_per_1m: 0, output_per_1m: 0 }
      };
    }
    
    await updateProfileModels('nvidia', modelsDict);
  } catch (err) {
    console.error('NVIDIA discovery failed:', err);
  }
}

async function main() {
  console.log('Starting dynamic model discovery and profile update...');
  await discoverOpenRouter();
  await discoverNvidia();
  console.log('\nDiscovery and update complete. Run "pnpm run knowledge:sync" next to build the JSON registry.');
}

main();