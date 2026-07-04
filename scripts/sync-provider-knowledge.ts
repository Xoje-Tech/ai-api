import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.resolve(__dirname, '../.knowledge/adapters');
const OUTPUT_FILE = path.resolve(__dirname, '../src/modules/ai-balancer/infrastructure/provider-registry.json');

async function syncProviderKnowledge() {
  console.log(`Syncing provider knowledge from ${KNOWLEDGE_DIR}...`);
  
  try {
    const files = await fs.readdir(KNOWLEDGE_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const registry: Record<string, any> = {};

    for (const file of mdFiles) {
      const filePath = path.join(KNOWLEDGE_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract YAML frontmatter
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) {
        console.warn(`[WARN] No frontmatter found in ${file}. Skipping.`);
        continue;
      }
      
      try {
        const parsed = yaml.load(match[1]) as any;
        
        // Ensure it's the right type
        if (parsed.type === 'Provider Profile' || parsed.type === 'AI Adapter') {
          const adapterId = parsed.implementation_binding?.adapter_id || path.basename(file, '.md');
          
          registry[adapterId] = {
            id: adapterId,
            name: parsed.title,
            description: parsed.description,
            tier_status: parsed.provider_config?.tier_status || 'unknown',
            tier_type: parsed.provider_config?.tier_type || 'unknown',
            usage_limits: parsed.provider_config?.usage_limits || {},
            models: parsed.provider_config?.models || {},
            env_required: parsed.implementation_binding?.env_required || []
          };
          console.log(`[OK] Parsed config for provider: ${adapterId}`);
        }
      } catch (err) {
        console.error(`[ERROR] Failed to parse YAML in ${file}:`, err);
      }
    }
    
    // Write out the JSON registry
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`\nSuccessfully wrote provider registry to ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error(`Fatal error syncing knowledge:`, error);
    process.exit(1);
  }
}

syncProviderKnowledge();