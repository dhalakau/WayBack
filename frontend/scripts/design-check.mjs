// design-check: static enforcement of the DESIGN.md anti-pattern bans.
//
// Scans frontend/src and exits non-zero on any violation, printing file:line
// for each. Only the statically checkable bans are enforced here. Bans that
// cannot be distinguished from their sanctioned replacement by static markers
// are intentionally skipped rather than risk a false positive.
//
// Enforced:
//   1. Em dash (U+2014) in any .js, .jsx, or .css file under src
//      (DESIGN.md Anti-Patterns ban 4: "Em dashes in UI copy").
//   2. The generic "M" placeholder avatar: a .wb-avatar element whose text is
//      the bare letter "M" (DESIGN.md ban 6). The sanctioned "MUC" city tag
//      passes.
//   3. The default iOS drag handle: a .wb-handle rule styled as the 36 by 4px
//      gray pill, detected by `background: var(--handle)` (DESIGN.md ban 5).
//      The sanctioned thin --pin line passes.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = join(SCRIPT_DIR, '..', 'src')
const REPO_DIR = join(SCRIPT_DIR, '..')

const EM_DASH = '—'
const SCANNED_EXTENSIONS = ['.js', '.jsx', '.css']

// Collect every scanned file under src, recursively.
function collectFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full))
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

// Turn a character offset in `text` into a 1-based line number.
function lineAt(text, index) {
  let line = 1
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') line++
  }
  return line
}

const violations = []
function report(file, line, column, message) {
  violations.push({ file: relative(REPO_DIR, file), line, column, message })
}

// Ban 4: em dashes. Reports every occurrence with its column.
function checkEmDash(file, text) {
  const lines = text.split('\n')
  lines.forEach((lineText, i) => {
    let col = lineText.indexOf(EM_DASH)
    while (col !== -1) {
      report(file, i + 1, col + 1, 'Em dash (U+2014) is banned (DESIGN.md ban 4). Use a period, colon, or parentheses.')
      col = lineText.indexOf(EM_DASH, col + 1)
    }
  })
}

// Ban 6: the generic "M" placeholder avatar. Matches a wb-avatar element whose
// immediate text content is a lone "M". The sanctioned "MUC" tag does not match
// because a letter follows the M before the closing angle bracket.
const AVATAR_PLACEHOLDER = /wb-avatar[^>]*>\s*M\s*</g
function checkAvatarPlaceholder(file, text) {
  let match
  while ((match = AVATAR_PLACEHOLDER.exec(text)) !== null) {
    report(file, lineAt(text, match.index), 1, 'Generic "M" placeholder avatar is banned (DESIGN.md ban 6). Use a real photo or the "MUC" city tag.')
  }
}

// Ban 5: the default iOS drag handle. Matches a `.wb-handle { ... }` rule (not
// `.wb-handle-area`) whose body sets `background: var(--handle)`, the gray pill.
// The sanctioned thin --pin line uses var(--pin) and does not match.
const HANDLE_RULE = /\.wb-handle\s*\{([^}]*)\}/g
function checkDefaultHandle(file, text) {
  let match
  while ((match = HANDLE_RULE.exec(text)) !== null) {
    if (/background:\s*var\(--handle\)/.test(match[1])) {
      report(file, lineAt(text, match.index), 1, 'Default iOS drag handle (36 by 4px gray pill) is banned (DESIGN.md ban 5). Use a thin --pin line.')
    }
  }
}

const files = collectFiles(SRC_DIR)
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  checkEmDash(file, text)
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    checkAvatarPlaceholder(file, text)
  }
  if (file.endsWith('.css')) {
    checkDefaultHandle(file, text)
  }
}

if (violations.length === 0) {
  console.log(`design-check: no DESIGN.md violations found across ${files.length} files.`)
  process.exit(0)
}

violations.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)))
console.error(`design-check: ${violations.length} DESIGN.md violation(s) found:\n`)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}:${v.column}  ${v.message}`)
}
process.exit(1)
