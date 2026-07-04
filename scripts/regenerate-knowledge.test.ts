import { describe, it, expect } from 'vitest';
import {
  parseAdapterSource,
  parseRoutesSource,
  parseEnvFile,
  generateAdapterMarkdown,
  generateEndpointsMarkdown,
  generateEnvMarkdown,
  buildIndexMarkdown,
  buildLogEntry,
} from './regenerate-knowledge.js';
import type { RouteEntry, EnvVar } from './regenerate-knowledge.js';

// ─── parseAdapterSource ────────────────────────────────────────────────────

describe('parseAdapterSource', () => {
  it('extracts the factory function name, service name, env var, and SDK package', () => {
    const source = `
      import { Groq } from 'groq-sdk';
      export function createGroqService(client: any): any {
        return { name: 'Groq', async chat() {} };
      }
      export function createGroqClient(): any {
        return new Groq({ apiKey: process.env.GROQ_API_KEY });
      }
    `;
    const doc = parseAdapterSource(source, 'src/modules/ai-balancer/infrastructure/adapters/groq.adapter.ts');
    expect(doc.factoryName).toBe('createGroqService');
    expect(doc.serviceName).toBe('Groq');
    expect(doc.sdkPackage).toBe('groq-sdk');
    expect(doc.envVars).toContain('GROQ_API_KEY');
    expect(doc.module).toBe('ai-balancer');
  });

  it('returns sensible defaults when the source has no factory or env var', () => {
    const doc = parseAdapterSource('// nothing here', 'src/modules/x/infrastructure/adapters/foo.adapter.ts');
    expect(doc.factoryName).toBe('createUnknownService');
    expect(doc.serviceName).toBe('Unknown');
    expect(doc.sdkPackage).toBeNull();
    expect(doc.envVars).toEqual([]);
  });

  it('captures multiple env vars when present', () => {
    const source = `
      export function createFoo() {
        return { name: 'Foo', chat() { return process.env.FOO_KEY + process.env.FOO_BASE; } };
      }
    `;
    const doc = parseAdapterSource(source, 'src/modules/x/infrastructure/adapters/foo.adapter.ts');
    expect(doc.envVars).toEqual(expect.arrayContaining(['FOO_KEY', 'FOO_BASE']));
  });
});

// ─── parseRoutesSource ─────────────────────────────────────────────────────

describe('parseRoutesSource', () => {
  it('extracts method+path combos from an inline dispatcher block', () => {
    const source = `
      export function buildApp(options: any) {
        const app = new Hono();
        app.all('*', async (c) => {
          if (c.req.method === 'GET' && c.req.path === '/health') return ok();
          if (c.req.method === 'POST' && c.req.path === '/chat') return ok();
          if (c.req.method === 'GET' && c.req.path === '/v1/models') return ok();
          if (c.req.path.startsWith('/users')) return ok();
          return new Response('Not found', { status: 404 });
        });
        return app;
      }
    `;
    const routes = parseRoutesSource(source, 'src/app.ts');
    const map = new Map(routes.map((r) => [r.method + ' ' + r.path, r]));
    expect(map.get('GET /health')).toBeDefined();
    expect(map.get('POST /chat')).toBeDefined();
    expect(map.get('GET /v1/models')).toBeDefined();
    expect(map.get('* /users')).toBeDefined();
  });

  it('returns [] for a file with no inline dispatcher', () => {
    const routes = parseRoutesSource('export const x = 1;', 'src/whatever.ts');
    expect(routes).toEqual([]);
  });

  it('infers the module name from the path', () => {
    const source = `
      export function x() {
        if (c.req.method === 'GET' && c.req.path === '/a') return ok();
      }
    `;
    const routes = parseRoutesSource(source, 'src/modules/users/interface/routes/users.route.ts');
    expect(routes[0]?.module).toBe('users');
  });
});

// ─── parseEnvFile ──────────────────────────────────────────────────────────

describe('parseEnvFile', () => {
  it('returns one entry per non-comment, non-blank line', () => {
    const content = `# comment
GROQ_API_KEY=gsk_xxx

# another comment
DATABASE_URL=postgres://u:p@h:5432/db
PORT=5678
`;
    const vars = parseEnvFile(content);
    expect(vars).toHaveLength(3);
    expect(vars[0]).toEqual({ name: 'GROQ_API_KEY', value: 'gsk_xxx' });
    expect(vars[1]).toEqual({ name: 'DATABASE_URL', value: 'postgres://u:p@h:5432/db' });
    expect(vars[2]).toEqual({ name: 'PORT', value: '5678' });
  });

  it('treats # only at line start as a comment (not inline)', () => {
    const content = `FOO=bar # inline\n# real\nBAZ=qux`;
    const vars = parseEnvFile(content);
    expect(vars).toHaveLength(2);
    expect(vars[0]?.name).toBe('FOO');
    expect(vars[1]?.name).toBe('BAZ');
  });

  it('preserves the value verbatim including placeholders', () => {
    const content = `DB=postgres://user:***@host:5432/db\n`;
    const vars = parseEnvFile(content);
    expect(vars[0]?.value).toBe('postgres://user:***@host:5432/db');
  });
});

// ─── generateAdapterMarkdown ───────────────────────────────────────────────

describe('generateAdapterMarkdown', () => {
  it('emits valid OKF frontmatter with type=AI Adapter', () => {
    const md = generateAdapterMarkdown(
      {
        basename: 'groq',
        module: 'ai-balancer',
        resourcePath: 'src/modules/ai-balancer/infrastructure/adapters/groq.adapter.ts',
        factoryName: 'createGroqService',
        serviceName: 'Groq',
        sdkPackage: 'groq-sdk',
        envVars: ['GROQ_API_KEY'],
      },
      '2026-06-29T22:00:00Z',
    );
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toMatch(/type: AI Adapter/);
    expect(md).toMatch(/title: Groq/);
    expect(md).toMatch(/resource: src\/modules\/ai-balancer\/infrastructure\/adapters\/groq\.adapter\.ts/);
    expect(md).toMatch(/timestamp: 2026-06-29T22:00:00Z/);
    expect(md).toMatch(/createGroqService/);
  });
});

// ─── generateEndpointsMarkdown ─────────────────────────────────────────────

describe('generateEndpointsMarkdown', () => {
  it('emits a Markdown table grouped by module', () => {
    const groups: Array<{ module: string; file: string; routes: RouteEntry[] }> = [
      { module: 'ai-balancer', file: 'src/app.ts', routes: [
        { method: 'GET', path: '/health', module: 'ai-balancer', file: 'src/app.ts' },
        { method: 'POST', path: '/chat', module: 'ai-balancer', file: 'src/app.ts' },
      ]},
    ];
    const md = generateEndpointsMarkdown(groups, '2026-06-29T22:00:00Z');
    expect(md).toMatch(/type: API Surface/);
    expect(md).toMatch(/## Module: ai-balancer/);
    expect(md).toMatch(/\| GET \| \/health \|/);
    expect(md).toMatch(/\| POST \| \/chat \|/);
  });
});

// ─── generateEnvMarkdown ───────────────────────────────────────────────────

describe('generateEnvMarkdown', () => {
  it('emits type=Environment Config and a table with one row per var', () => {
    const vars: EnvVar[] = [
      { name: 'GROQ_API_KEY', value: 'gsk_xxx' },
      { name: 'PORT', value: '5678' },
    ];
    const md = generateEnvMarkdown(vars, '2026-06-29T22:00:00Z');
    expect(md).toMatch(/type: Environment Config/);
    expect(md).toMatch(/\| `GROQ_API_KEY` \|/);
    expect(md).toMatch(/\| `PORT` \|/);
  });
});

// ─── buildIndexMarkdown ────────────────────────────────────────────────────

describe('buildIndexMarkdown', () => {
  it('lists every other page with a one-line summary', () => {
    const md = buildIndexMarkdown(
      [
        { path: 'adapters/groq.md', title: 'Groq', summary: 'groq-sdk adapter' },
        { path: 'adapters/openrouter.md', title: 'OpenRouter', summary: '@openrouter/sdk adapter' },
      ],
      '2026-06-29T22:00:00Z',
    );
    expect(md).toMatch(/type: Index/);
    expect(md).toMatch(/\[Groq\]\(\.\/adapters\/groq\.md\)/);
    expect(md).toMatch(/\[OpenRouter\]\(\.\/adapters\/openrouter\.md\)/);
  });
});

// ─── buildLogEntry ─────────────────────────────────────────────────────────

describe('buildLogEntry', () => {
  it('returns a single timestamped line', () => {
    const entry = buildLogEntry('all', '2026-06-29T22:00:00Z');
    expect(entry).toMatch(/^- 2026-06-29T22:00:00Z — regenerated target=all/);
  });
});

// ─── idempotency ───────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('parseAdapterSource + generateAdapterMarkdown is stable across two runs', () => {
    const source = `
      import { Groq } from 'groq-sdk';
      export function createGroqService(client: any): any {
        return { name: 'Groq', async chat() {} };
      }
    `;
    const path = 'src/modules/ai-balancer/infrastructure/adapters/groq.adapter.ts';
    const ts = '2026-06-29T22:00:00Z';
    const a = generateAdapterMarkdown(parseAdapterSource(source, path), ts);
    const b = generateAdapterMarkdown(parseAdapterSource(source, path), ts);
    expect(a).toBe(b);
  });

  it('parseEnvFile + generateEnvMarkdown is stable across two runs', () => {
    const content = `FOO=bar\nBAZ=qux\n`;
    const ts = '2026-06-29T22:00:00Z';
    const a = generateEnvMarkdown(parseEnvFile(content), ts);
    const b = generateEnvMarkdown(parseEnvFile(content), ts);
    expect(a).toBe(b);
  });
});