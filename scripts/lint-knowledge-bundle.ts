/**
 * scripts/lint-knowledge-bundle.ts
 *
 * Lints the `.knowledge/` OKF bundle. Pure function `lintKnowledgeBundle`
 * returns structured issues; `main()` is the CLI entry that walks the
 * filesystem and exits non-zero on CRITICAL findings.
 *
 * Severity ordering (in the report): broken-link > missing-frontmatter > missing-type.
 * Exit code: 1 if any CRITICAL issue, else 0.
 *
 * No external dependencies — only Node.js stdlib.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Types ────────────────────────────────────────────────────────────────

export type IssueKind = 'broken-link' | 'missing-frontmatter' | 'missing-type';
export type Severity = 'critical' | 'warning';

export interface LintIssue {
  file: string;        // path relative to bundle root
  kind: IssueKind;
  severity: Severity;
  detail: string;
}

export interface LintResult {
  bundleRoot: string;
  issues: LintIssue[];
  criticalCount: number;
}

const KIND_ORDER: IssueKind[] = ['broken-link', 'missing-frontmatter', 'missing-type'];

// ─── Pure helpers ─────────────────────────────────────────────────────────

/** Walk a directory recursively and yield every `.md` file (absolute path). */
export function walkMarkdown(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const st = statSync(abs);
      if (st.isDirectory()) {
        visit(abs);
      } else if (st.isFile() && abs.endsWith('.md')) {
        out.push(abs);
      }
    }
  };
  if (existsSync(root)) visit(root);
  return out.sort();
}

/** Extract YAML frontmatter (between leading `---` fences). Returns null if absent. */
export function readFrontmatter(content: string): Record<string, string> | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return null;
  const block = content.slice(3, end);
  const out: Record<string, string> = {};
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    out[key] = value;
  }
  return out;
}

/** Find every Markdown link `[text](target)`. External (http/https/mailto) and anchors are excluded from link-checking. */
export function extractLinks(content: string): string[] {
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  const out: string[] = [];
  for (const m of content.matchAll(re)) {
    const t = m[1]!.split(/\s+/)[0]!.trim();
    if (!t) continue;
    if (/^(https?:|mailto:|#)/i.test(t)) continue;
    out.push(t);
  }
  return out;
}

// ─── Lint ─────────────────────────────────────────────────────────────────

export function lintKnowledgeBundle(bundleRoot: string): LintResult {
  const files = walkMarkdown(bundleRoot);
  const issues: LintIssue[] = [];

  // Pre-compute the set of existing files (relative paths) for fast lookup.
  const fileSet = new Set<string>();
  for (const abs of files) {
    fileSet.add(relative(bundleRoot, abs).split('\\').join('/'));
  }

  for (const abs of files) {
    const rel = relative(bundleRoot, abs).split('\\').join('/');
    const content = readFileSync(abs, 'utf-8');
    const fm = readFrontmatter(content);

    if (!fm) {
      issues.push({ file: rel, kind: 'missing-frontmatter', severity: 'critical', detail: 'no `---` frontmatter block at top of file' });
      // Still check links so the order in the report is correct.
      const links = extractLinks(content);
      for (const link of links) {
        if (!linkExists(bundleRoot, rel, link, fileSet)) {
          issues.push({ file: rel, kind: 'broken-link', severity: 'critical', detail: `link target not found: ${link}` });
        }
      }
      continue;
    }

    if (!fm.type || fm.type.trim() === '') {
      issues.push({ file: rel, kind: 'missing-type', severity: 'critical', detail: 'frontmatter missing required `type` field' });
    }

    const links = extractLinks(content);
    for (const link of links) {
      if (!linkExists(bundleRoot, rel, link, fileSet)) {
        issues.push({ file: rel, kind: 'broken-link', severity: 'critical', detail: `link target not found: ${link}` });
      }
    }
  }

  // Order: broken-link > missing-frontmatter > missing-type; then by file.
  issues.sort((a, b) => {
    const ka = KIND_ORDER.indexOf(a.kind);
    const kb = KIND_ORDER.indexOf(b.kind);
    if (ka !== kb) return ka - kb;
    return a.file.localeCompare(b.file);
  });

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  return { bundleRoot, issues, criticalCount };
}

function linkExists(bundleRoot: string, fromRel: string, link: string, fileSet: Set<string>): boolean {
  // Strip a leading `./`
  let target = link.replace(/^\.\//, '');
  // Strip anchor fragment
  const hash = target.indexOf('#');
  if (hash >= 0) target = target.slice(0, hash);

  // Empty target (e.g. `[text]()`) is not a valid link — caller treats as broken.
  if (!target) return false;

  // Absolute (rare): resolve against bundleRoot.
  if (target.startsWith('/')) {
    return fileSet.has(target.replace(/^\//, ''));
  }

  // Relative: resolve against the source file's directory.
  const fromDir = dirname(fromRel);
  const resolved = fromDir === '.' ? target : join(fromDir, target).split('\\').join('/');
  if (fileSet.has(resolved)) return true;
  // Try without trailing .md (the convention here is to always include it, but be lenient).
  if (!resolved.endsWith('.md') && fileSet.has(resolved + '.md')) return true;

  // Link exits the bundle (e.g. `../AGENTS.md` or `../src/...`) — verify on the
  // real filesystem so cross-bundle references (to source code, scripts, the
  // project root) are accepted as long as the target exists.
  const abs = resolve(bundleRoot, resolved);
  if (abs !== bundleRoot && !abs.startsWith(bundleRoot + '/')) {
    return existsSync(abs);
  }
  return false;
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function resolveBundleRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '.knowledge');
}

function formatIssues(result: LintResult): string {
  const lines: string[] = [];
  lines.push(`Knowledge lint — ${result.issues.length} issue(s), ${result.criticalCount} critical`);
  if (result.issues.length === 0) {
    lines.push('  (clean)');
    return lines.join('\n');
  }
  let prevKind: IssueKind | null = null;
  for (const i of result.issues) {
    if (i.kind !== prevKind) {
      lines.push('');
      lines.push(`## ${i.kind}`);
      prevKind = i.kind;
    }
    lines.push(`  ${i.severity.toUpperCase()}  ${i.file}  —  ${i.detail}`);
  }
  return lines.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const root = argv[0] && !argv[0]!.startsWith('-') ? resolve(argv[0]!) : resolveBundleRoot();
  const result = lintKnowledgeBundle(root);
  // eslint-disable-next-line no-console
  console.log(formatIssues(result));
  return result.criticalCount > 0 ? 1 : 0;
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  process.exit(main());
}