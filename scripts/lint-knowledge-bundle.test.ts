import { describe, it, expect } from 'vitest';
import { lintKnowledgeBundle } from './lint-knowledge-bundle.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-lint-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

describe('lintKnowledgeBundle', () => {
  it('passes for a valid bundle with all frontmatter + resolvable links', () => {
    const dir = makeFixture({
      'index.md': `---\ntype: Index\ntitle: X\n---\n# X\nsee [a](./a.md)\n`,
      'a.md': `---\ntype: Doc\ntitle: A\n---\n# A\nsee [index](./index.md)\n`,
    });
    try {
      const res = lintKnowledgeBundle(dir);
      expect(res.criticalCount).toBe(0);
      expect(res.issues).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports CRITICAL for missing frontmatter', () => {
    const dir = makeFixture({
      'a.md': '# no frontmatter\n',
    });
    try {
      const res = lintKnowledgeBundle(dir);
      const fm = res.issues.filter((i) => i.kind === 'missing-frontmatter');
      expect(fm.length).toBeGreaterThan(0);
      expect(fm[0]?.severity).toBe('critical');
      expect(res.criticalCount).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports CRITICAL for frontmatter missing required `type` field', () => {
    const dir = makeFixture({
      'a.md': `---\ntitle: NoType\n---\n# x\n`,
    });
    try {
      const res = lintKnowledgeBundle(dir);
      const missingType = res.issues.filter((i) => i.kind === 'missing-type');
      expect(missingType.length).toBeGreaterThan(0);
      expect(missingType[0]?.severity).toBe('critical');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports CRITICAL for broken internal links', () => {
    const dir = makeFixture({
      'index.md': `---\ntype: Index\ntitle: I\n---\n# I\nsee [nope](./does-not-exist.md)\n`,
    });
    try {
      const res = lintKnowledgeBundle(dir);
      const broken = res.issues.filter((i) => i.kind === 'broken-link');
      expect(broken.length).toBeGreaterThan(0);
      expect(broken[0]?.severity).toBe('critical');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not flag external http(s) links as broken', () => {
    const dir = makeFixture({
      'a.md': `---\ntype: Doc\ntitle: A\n---\nsee [ext](https://example.com)\n`,
    });
    try {
      const res = lintKnowledgeBundle(dir);
      expect(res.issues.filter((i) => i.kind === 'broken-link')).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('orders broken links > missing frontmatter > invalid type in the report', () => {
    // Three separate files, each producing exactly one issue kind.
    // Order check verifies that the report groups/sorts broken-link first,
    // missing-frontmatter second, missing-type third — regardless of which
    // file produced which issue.
    const dir = makeFixture({
      'no-type.md': `---\ntitle: only title\n---\nsee [a](./also-missing.md)\n`,
      'no-fm.md': `# no frontmatter\nsee [b](./also-missing.md)\n`,
      'broken.md': `---\ntype: Doc\ntitle: B\n---\nsee [nope](./does-not-exist.md)\n`,
    });
    try {
      const res = lintKnowledgeBundle(dir);
      // Sanity: every kind should appear at least once.
      const kinds = new Set(res.issues.map((i) => i.kind));
      expect(kinds.has('broken-link')).toBe(true);
      expect(kinds.has('missing-frontmatter')).toBe(true);
      expect(kinds.has('missing-type')).toBe(true);

      const order = res.issues.map((i) => i.kind);
      const firstBroken = order.indexOf('broken-link');
      const firstFm = order.indexOf('missing-frontmatter');
      const firstType = order.indexOf('missing-type');
      expect(firstBroken).toBeLessThan(firstFm);
      expect(firstFm).toBeLessThan(firstType);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});