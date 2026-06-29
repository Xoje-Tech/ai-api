/**
 * scripts/regenerate-knowledge.ts
 *
 * Regenerates the `.knowledge/` OKF (Open Knowledge Format) bundle from the
 * project's source tree. Pure functions (parseAdapterSource, parseRoutesSource,
 * parseEnvFile, generate*) are exported and unit-tested independently;
 * `main()` is the CLI entry that walks the filesystem and writes the bundle.
 *
 * Idempotency: re-running with the same inputs produces the same output for
 * every file except `log.md`, which is appended to.
 *
 * No external dependencies — only Node.js stdlib.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  appendFileSync,
} from 'node:fs';
import { dirname, join, relative, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Types ────────────────────────────────────────────────────────────────

export interface AdapterDoc {
  basename: string;
  module: string;
  resourcePath: string;
  factoryName: string;
  serviceName: string;
  sdkPackage: string | null;
  envVars: string[];
}

export interface RouteEntry {
  method: string;
  path: string;
  module: string;
  file: string;
}

export interface EnvVar {
  name: string;
  value: string;
}

export interface IndexEntry {
  path: string;
  title: string;
  summary: string;
}

export interface RoutesGroup {
  module: string;
  file: string;
  routes: RouteEntry[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

/** Derive the module name from a path like `src/modules/ai-balancer/...`. */
function moduleFromPath(filePath: string): string {
  const m = filePath.match(/src\/modules\/([^/]+)\//);
  if (m && m[1]) return m[1];
  if (filePath.endsWith('src/app.ts')) return 'app';
  return 'unknown';
}

/** Derive a base name like 'groq' from 'groq.adapter.ts'. */
function adapterBaseName(fileName: string): string {
  return fileName.replace(/\.adapter\.ts$/, '').replace(/\.ts$/, '');
}

/** Strip the project root from an absolute path. */
function relToProject(absPath: string, projectRoot: string): string {
  return relative(projectRoot, absPath).split('\\').join('/');
}

/** Escape a value for safe inclusion in a YAML scalar (no quotes → no escape needed beyond wrapping). */
function yamlScalar(v: string): string {
  // If the value contains a colon, hash, or starts with a special char, wrap in quotes.
  if (/[:#\n]|^(true|false|null|~|\d)/i.test(v)) return `"${v.replace(/"/g, '\\"')}"`;
  return v;
}

// ─── Parsers ──────────────────────────────────────────────────────────────

/**
 * Extract a structured adapter doc from a single adapter source file.
 *
 * Looks for: an SDK import (`from 'pkg'`), an exported factory whose name
 * matches `createXService`, the literal `name: 'Foo'` inside the factory,
 * and `process.env.VAR` references.
 */
export function parseAdapterSource(source: string, filePath: string): AdapterDoc {
  const module = moduleFromPath(filePath);
  const fileName = basename(filePath);
  const basename_ = adapterBaseName(fileName);

  // SDK package — first non-type-only import statement
  let sdkPackage: string | null = null;
  const importMatch = source.match(/from\s+['"]([^'"]+)['"]/);
  if (importMatch && importMatch[1]) sdkPackage = importMatch[1];

  // Factory name — prefer createXService/createYService patterns, else createXClient
  const factoryRe = /export function (create\w+Service|create\w+Client)\s*\(/g;
  const factoryMatch = factoryRe.exec(source);
  const factoryName = factoryMatch?.[1] ?? 'createUnknownService';

  // Service name from `name: 'Foo'`
  const nameMatch = source.match(/name:\s*['"]([^'"]+)['"]/);
  const serviceName = nameMatch?.[1] ?? 'Unknown';

  // Env var refs
  const envRe = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  const envVars = Array.from(new Set(Array.from(source.matchAll(envRe), (m) => m[1]!).filter(Boolean)));

  return {
    basename: basename_,
    module,
    resourcePath: filePath,
    factoryName,
    serviceName,
    sdkPackage,
    envVars,
  };
}

/**
 * Extract `method + path` pairs from an inline dispatcher block (the
 * `app.all('*', ...)` style used in `src/app.ts`). For per-route files
 * like `users.route.ts`, the dispatcher is in `handleUsers`.
 *
 * Recognised shapes:
 *   - `c.req.method === 'GET' && c.req.path === '/health'`
 *   - `c.req.path.startsWith('/users')`         → method='*'
 *   - `req.method === 'POST' && pathname === '/users'`
 */
export function parseRoutesSource(source: string, filePath: string): RouteEntry[] {
  const module = moduleFromPath(filePath);
  const out: RouteEntry[] = [];
  const seen = new Set<string>();

  const push = (method: string, path: string) => {
    const key = method + ' ' + path;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ method, path, module, file: filePath });
  };

  // `c.req.method === 'X' && c.req.path === '/Y'`
  const re1 = /c\.req\.method\s*===\s*['"]([A-Z]+)['"]\s*&&\s*c\.req\.path\s*===\s*['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(re1)) push(m[1]!, m[2]!);

  // `req.method === 'X' && pathname === '/Y'`
  const re2 = /req\.method\s*===\s*['"]([A-Z]+)['"]\s*&&\s*pathname\s*===\s*['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(re2)) push(m[1]!, m[2]!);

  // `c.req.path.startsWith('/users')`
  const re3 = /(?:c\.req\.path|pathname)\.startsWith\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of source.matchAll(re3)) push('*', m[1]!);

  // method+path on a single match in either order
  const re4 = /(?:c\.req\.method|req\.method)\s*===\s*['"]([A-Z]+)['"][\s\S]*?(?:c\.req\.path|pathname)\s*===\s*['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(re4)) push(m[1]!, m[2]!);

  return out;
}

/**
 * Parse a `.env`-style file into a flat list of `{ name, value }` entries.
 * Lines starting with `#` are comments; blank lines are skipped. Inline
 * `#` after a value is preserved as part of the value.
 */
export function parseEnvFile(content: string): EnvVar[] {
  const out: EnvVar[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!name) continue;
    out.push({ name, value });
  }
  return out;
}

// ─── Markdown generators ──────────────────────────────────────────────────

export function generateAdapterMarkdown(doc: AdapterDoc, timestamp: string): string {
  const title = doc.serviceName;
  const description =
    `Adapter wrapping ${doc.sdkPackage ?? 'an LLM SDK'} for chat completions with streaming SSE support.`;
  const tags = ['adapter', doc.basename, doc.module, 'streaming'].filter(Boolean);
  const frontmatter = [
    '---',
    `type: AI Adapter`,
    `title: ${yamlScalar(title)}`,
    `description: ${yamlScalar(description)}`,
    `resource: ${doc.resourcePath}`,
    `tags: [${tags.join(', ')}]`,
    `timestamp: ${timestamp}`,
    '---',
    '',
  ].join('\n');

  const envBlock = doc.envVars.length
    ? `\n## Environment\n\nThis adapter reads:\n\n${doc.envVars.map((v) => `- \`${v}\``).join('\n')}\n`
    : '';

  const body = [
    `# ${title} Adapter`,
    '',
    `Source: \`${doc.resourcePath}\``,
    '',
    `Factory: \`${doc.factoryName}\`. Service name: \`${doc.serviceName}\`.`,
    envBlock,
    '## Related',
    '',
    '- [OpenRouter](./openrouter.md) — sibling adapter.',
    '- [Endpoints](../api/endpoints.md) — HTTP surface.',
  ].join('\n');

  return frontmatter + body + '\n';
}

export function generateEndpointsMarkdown(groups: RoutesGroup[], timestamp: string): string {
  const totalRoutes = groups.reduce((n, g) => n + g.routes.length, 0);
  const frontmatter = [
    '---',
    `type: API Surface`,
    `title: HTTP Endpoints`,
    `description: Auto-regenerated list of HTTP endpoints (${totalRoutes} entries across ${groups.length} module(s)).`,
    `resource: src/app.ts`,
    `tags: [api, http, endpoints]`,
    `timestamp: ${timestamp}`,
    '---',
    '',
  ].join('\n');

  const sections: string[] = ['# HTTP Endpoints', ''];
  for (const g of groups) {
    sections.push(`## Module: ${g.module}`);
    sections.push('');
    sections.push('| Method | Path | Source |');
    sections.push('|--------|------|--------|');
    for (const r of g.routes) {
      sections.push(`| ${r.method} | ${r.path} | \`${r.file}\` |`);
    }
    sections.push('');
  }
  return frontmatter + sections.join('\n') + '\n';
}

export function generateEnvMarkdown(vars: EnvVar[], timestamp: string): string {
  const frontmatter = [
    '---',
    `type: Environment Config`,
    `title: Environment Variables`,
    `description: Auto-regenerated from .env.example (${vars.length} entries).`,
    `resource: .env.example`,
    `tags: [env, config]`,
    `timestamp: ${timestamp}`,
    '---',
    '',
  ].join('\n');

  const rows = vars.map((v) => `| \`${v.name}\` | (see \`.env.example\`) | \`${v.value}\` |`).join('\n');
  const body = [
    '# Environment Variables',
    '',
    '| Variable | Required | Default / Example |',
    '|----------|----------|-------------------|',
    rows,
    '',
  ].join('\n');

  return frontmatter + body + '\n';
}

export function buildIndexMarkdown(entries: IndexEntry[], timestamp: string): string {
  const frontmatter = [
    '---',
    `type: Index`,
    `title: Knowledge Bundle Index`,
    `description: Auto-regenerated catalog of every page in the OKF bundle.`,
    `resource: .knowledge/`,
    `tags: [okf, index]`,
    `timestamp: ${timestamp}`,
    '---',
    '',
  ].join('\n');

  const groups = new Map<string, IndexEntry[]>();
  for (const e of entries) {
    const top = e.path.includes('/') ? e.path.split('/')[0]! : 'root';
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top)!.push(e);
  }

  const sections: string[] = ['# Knowledge Bundle', ''];
  for (const [top, list] of groups) {
    sections.push(`## ${top}`);
    sections.push('');
    for (const e of list) {
      sections.push(`- [${e.title}](./${e.path}) — ${e.summary}`);
    }
    sections.push('');
  }
  return frontmatter + sections.join('\n') + '\n';
}

export function buildLogEntry(target: string, timestamp: string): string {
  return `- ${timestamp} — regenerated target=${target}\n`;
}

// ─── Filesystem walks ─────────────────────────────────────────────────────

function walkAdapters(projectRoot: string): AdapterDoc[] {
  const root = join(projectRoot, 'src/modules');
  if (!existsSync(root)) return [];
  const docs: AdapterDoc[] = [];
  for (const mod of readdirSync(root)) {
    const dir = join(root, mod, 'infrastructure/adapters');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue;
      if (f.endsWith('.test.ts') || f.endsWith('.spec.ts')) continue;
      const abs = join(dir, f);
      const src = readFileSync(abs, 'utf-8');
      const doc = parseAdapterSource(src, relToProject(abs, projectRoot));
      docs.push(doc);
    }
  }
  return docs.sort((a, b) => a.basename.localeCompare(b.basename));
}

function walkRoutes(projectRoot: string): RoutesGroup[] {
  const out: RoutesGroup[] = [];
  const appPath = join(projectRoot, 'src/app.ts');
  if (existsSync(appPath)) {
    const src = readFileSync(appPath, 'utf-8');
    out.push({
      module: 'app',
      file: 'src/app.ts',
      routes: parseRoutesSource(src, 'src/app.ts'),
    });
  }
  const root = join(projectRoot, 'src/modules');
  if (!existsSync(root)) return out;
  for (const mod of readdirSync(root)) {
    const dir = join(root, mod, 'interface/routes');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue;
      const abs = join(dir, f);
      const src = readFileSync(abs, 'utf-8');
      out.push({
        module: mod,
        file: relToProject(abs, projectRoot),
        routes: parseRoutesSource(src, relToProject(abs, projectRoot)),
      });
    }
  }
  return out;
}

// ─── Writers ──────────────────────────────────────────────────────────────

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeIfChanged(filePath: string, content: string): boolean {
  const prev = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null;
  if (prev === content) return false;
  ensureDir(filePath);
  writeFileSync(filePath, content);
  return true;
}

// ─── CLI ──────────────────────────────────────────────────────────────────

type Target = 'adapters' | 'api' | 'env' | 'all';

function parseArgs(argv: string[]): { target: Target } {
  let target: Target = 'all';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target' && argv[i + 1]) {
      const t = argv[i + 1] as Target;
      if (t !== 'adapters' && t !== 'api' && t !== 'env' && t !== 'all') {
        throw new Error(`Unknown --target value: ${t}`);
      }
      target = t;
      i++;
    }
  }
  return { target };
}

function resolveProjectRoot(): string {
  // scripts/regenerate-knowledge.ts → ../ (project root)
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..');
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function main(argv: string[] = process.argv.slice(2)): { changed: string[]; target: Target } {
  const { target } = parseArgs(argv);
  const projectRoot = resolveProjectRoot();
  const knowledgeDir = join(projectRoot, '.knowledge');
  mkdirSync(knowledgeDir, { recursive: true });

  const timestamp = nowIso();
  const changed: string[] = [];
  const writeOne = (relPath: string, content: string) => {
    const abs = join(knowledgeDir, relPath);
    if (writeIfChanged(abs, content)) changed.push(relPath);
  };

  const doAdapters = target === 'adapters' || target === 'all';
  const doApi = target === 'api' || target === 'all';
  const doEnv = target === 'env' || target === 'all';

  if (doAdapters) {
    const docs = walkAdapters(projectRoot);
    for (const d of docs) {
      writeOne(`adapters/${d.basename}.md`, generateAdapterMarkdown(d, timestamp));
    }
  }

  if (doApi) {
    const groups = walkRoutes(projectRoot);
    writeOne('api/endpoints.md', generateEndpointsMarkdown(groups, timestamp));
  }

  if (doEnv) {
    const envPath = join(projectRoot, '.env.example');
    if (existsSync(envPath)) {
      const vars = parseEnvFile(readFileSync(envPath, 'utf-8'));
      writeOne('env/variables.md', generateEnvMarkdown(vars, timestamp));
    }
  }

  if (target === 'all') {
    // index.md is HAND-WRITTEN — never overwrite after first creation.
    // The regenerator only initializes it once when missing; the human curates
    // it thereafter. Architecture decisions live in `architecture/*.md`, not here.
    const indexPath = join(knowledgeDir, 'index.md');
    if (!existsSync(indexPath)) {
      const entries: IndexEntry[] = [];
      const summaryByPath = new Map<string, string>([
        ['adapters/groq.md', 'groq-sdk adapter.'],
        ['adapters/openrouter.md', '@openrouter/sdk adapter.'],
        ['api/endpoints.md', 'HTTP surface.'],
        ['env/variables.md', '.env.example variables.'],
        ['architecture/circuit-breaker-balancer.md', 'Circuit breaker balancer pattern.'],
        ['architecture/round-robin-balancer.md', 'Round-robin balancer pattern.'],
      ]);
      for (const [p, summary] of summaryByPath) {
        const abs = join(knowledgeDir, p);
        if (!existsSync(abs)) continue;
        const md = readFileSync(abs, 'utf-8');
        const titleMatch = md.match(/^title:\s*(.+)$/m);
        entries.push({ path: p, title: titleMatch?.[1]?.trim() ?? p, summary });
      }
      writeOne('index.md', buildIndexMarkdown(entries, timestamp));
    }

    // log.md is APPEND-ONLY — never overwrite.
    const logPath = join(knowledgeDir, 'log.md');
    if (existsSync(logPath)) {
      appendFileSync(logPath, buildLogEntry(target, timestamp));
      changed.push('log.md');
    } else {
      const header = [
        '---',
        'type: Changelog',
        'title: Knowledge Bundle Log',
        'description: Append-only history of regeneration events.',
        'resource: log.md',
        'tags: [okf, changelog]',
        `timestamp: ${timestamp}`,
        '---',
        '',
        '# Knowledge Bundle Log',
        '',
        buildLogEntry(target, timestamp),
      ].join('\n');
      writeFileSync(logPath, header);
      changed.push('log.md');
    }
  }

  return { changed, target };
}

// Run only when invoked directly (not when imported by tests).
const invokedDirectly =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  const { changed, target } = main();
  // eslint-disable-next-line no-console
  console.log(`knowledge:regen (target=${target}) — changed ${changed.length} file(s):`);
  for (const c of changed) console.log('  ' + c);
}