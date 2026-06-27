/**
 * sync-programs-library.mjs
 *
 * Syncs newly-scraped OFAC General License / Executive Order data — and, on a
 * best-effort basis, designation-style advisories — into the hand-curated
 * src/lib/sanctions-programs-library.ts file.
 *
 * WHY THIS EXISTS
 * sanctions-programs-library.ts has zero programmatic writers. refresh-briefing.mjs
 * already scrapes each OFAC program page (EOs, GL PDF links, FR notices) into
 * data/ofac-cache.json, but that data was never wired into the curated library —
 * so a newly issued GL could sit in the cache indefinitely without ever showing up
 * on the program page users actually browse. This module closes that gap.
 *
 * SAFETY MODEL (read before changing anything below)
 * This edits a compliance-relevant, hand-curated file with plain string surgery —
 * no AST, because the CI job doesn't run `npm ci` and adding a TS-parser dependency
 * would slow down a pipeline tuned to dodge free-tier rate limits. Given that, the
 * overriding rule is: NEVER WRITE A FILE THAT MIGHT BE WRONG.
 *   - Every insertion is scoped to a single program's block, found by brace-depth
 *     matching, never by a global regex across the whole file.
 *   - Archiving a superseded GL only happens when the program already has an
 *     `archive: { generalLicenses: [...] }` block to move it into. If not, the new
 *     GL is still added, but the predecessor is left in place and logged — never
 *     silently dropped, never guessed at.
 *   - A sanity check on bracket balance and block count runs before every commit;
 *     any mismatch aborts the whole sync with nothing written.
 *   - Tier 2 (designation/advisory detection) only fires on unambiguous program-name
 *     matches and only appends to keyAdvisories arrays that already exist.
 */

const LIB_PATH = "src/lib/sanctions-programs-library.ts";

const today = () =>
  new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// ── GitHub Contents API ─────────────────────────────────────────────────────
async function getFile(repo, token, path) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  const json = await res.json();
  return { sha: json.sha, content: Buffer.from(json.content, "base64").toString("utf8") };
}

async function putFile(repo, token, path, content, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64"), sha }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ── Generic bracket-depth matcher: given the index of an opening bracket,
//    return the index just past its matching close. [ and { both count as
//    "open", ] and } both count as "close" — safe because valid TS always
//    nests them correctly and we only care about returning to depth 0.
function matchBracket(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// ── Split the SANCTIONS_PROGRAMS array into its top-level program blocks ────
function findProgramsArrayOpen(src, exportIdx) {
  // NOTE: "SanctionsProgram[]" in the type annotation contains its own "[]"
  // immediately after the export keyword — indexOf("[", exportIdx) would grab
  // that bracket instead of the actual array literal's "[". Anchor on the
  // "=" sign instead, which always precedes the real array-literal bracket.
  const eqIdx = src.indexOf("=", exportIdx);
  if (eqIdx === -1) throw new Error("Could not find '=' after SANCTIONS_PROGRAMS export");
  return src.indexOf("[", eqIdx);
}

function splitProgramBlocks(src) {
  const exportIdx = src.indexOf("export const SANCTIONS_PROGRAMS");
  if (exportIdx === -1) throw new Error("SANCTIONS_PROGRAMS export not found");
  const arrOpen = findProgramsArrayOpen(src, exportIdx);
  const arrClose = matchBracket(src, arrOpen);
  if (arrClose === -1) throw new Error("Could not find end of SANCTIONS_PROGRAMS array");

  const body = src.slice(arrOpen + 1, arrClose - 1);
  const bodyOffset = arrOpen + 1;

  const blocks = [];
  let pos = 0;
  while (true) {
    const rel = body.indexOf("\n  {", pos);
    if (rel === -1) break;
    const entryStart = rel + 1; // index of "{"
    const entryEnd = matchBracket(body, entryStart); // index just past matching "}"
    if (entryEnd === -1) throw new Error("Unbalanced program block — aborting");
    blocks.push({ start: bodyOffset + entryStart, end: bodyOffset + entryEnd, text: body.slice(entryStart, entryEnd) });
    pos = entryEnd;
  }
  return blocks;
}

function getBlockMeta(blockText) {
  const id = /id:\s*"([^"]+)"/.exec(blockText)?.[1];
  const slug = /url:\s*"https:\/\/ofac\.treasury\.gov\/sanctions-programs-and-country-information\/([^"]+)"/.exec(blockText)?.[1];
  const name = /name:\s*"([^"]+)"/.exec(blockText)?.[1];
  if (!id || !slug) return null;
  return { id, slug, name };
}

// ── Pull `archive: { ... }` out of a block into three pieces so edits to the
//    fields before it (executiveOrders/generalLicenses/keyAdvisories) never
//    have to worry about a stale offset into the archive section.
function splitArchive(blockText) {
  const m = /archive\s*:\s*\{/.exec(blockText);
  if (!m) return { beforeArchive: blockText, archiveText: null, afterArchive: "" };
  const braceOpen = blockText.indexOf("{", m.index);
  const braceClose = matchBracket(blockText, braceOpen);
  if (braceClose === -1) throw new Error("Unbalanced archive block");
  return {
    beforeArchive: blockText.slice(0, m.index),
    archiveText: blockText.slice(m.index, braceClose),
    afterArchive: blockText.slice(braceClose),
  };
}

// ── Locate a named array (e.g. "generalLicenses") within a text fragment ────
function findArray(text, key) {
  const re = new RegExp(`\\b${key}\\s*:\\s*\\[`);
  const m = re.exec(text);
  if (!m) return null;
  const bracketOpen = text.indexOf("[", m.index);
  const bracketClose = matchBracket(text, bracketOpen);
  if (bracketClose === -1) return null;
  return {
    bracketOpen,
    bracketClose, // index just past the closing "]"
    itemsText: text.slice(bracketOpen + 1, bracketClose - 1),
  };
}

function replaceArray(text, arr, newItemsText) {
  return text.slice(0, arr.bracketOpen + 1) + newItemsText + text.slice(arr.bracketClose - 1);
}

function extractNumbers(itemsText) {
  const nums = new Set();
  const re = /number:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(itemsText)) !== null) nums.add(m[1]);
  return nums;
}

function extractUrls(itemsText) {
  const urls = new Set();
  const re = /url:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(itemsText)) !== null) urls.add(m[1]);
  return urls;
}

// Remove the line containing `number: "<num>"` from itemsText. Returns
// { text, removedLine } — removedLine is null if no such line was found.
function removeEntryLine(itemsText, number) {
  const lines = itemsText.split("\n");
  const idx = lines.findIndex((l) => l.includes(`number: "${number}"`));
  if (idx === -1) return { text: itemsText, removedLine: null };
  const removedLine = lines[idx];
  lines.splice(idx, 1);
  return { text: lines.join("\n"), removedLine };
}

// Insert newEntryLines (already newline-terminated and indented) right before
// the first existing `{` entry in itemsText, after any leading `//` comments.
function insertAtTop(itemsText, newEntryLines) {
  if (!newEntryLines) return itemsText;
  const firstBrace = itemsText.indexOf("{");
  if (firstBrace === -1) {
    // Empty array (e.g. "generalLicenses: []") — fall back to a default indent.
    return `\n      ${newEntryLines.trim()}\n    `;
  }
  return itemsText.slice(0, firstBrace) + newEntryLines + itemsText.slice(firstBrace);
}

function entryIndentOf(itemsText) {
  const firstBrace = itemsText.indexOf("{");
  if (firstBrace === -1) return "      ";
  const lineStart = itemsText.lastIndexOf("\n", firstBrace) + 1;
  return itemsText.slice(lineStart, firstBrace);
}

function glPrefix(num) {
  const m = /^(\d+)([A-Za-z]*)$/.exec(num);
  return m ? m[1] : num;
}

// Convert a Roman numeral string to an integer, or null if it isn't one.
// Used for GL series that rotate through plain Roman numerals (Iran's rolling
// petroleum GLs: ... VIII, IX, X, XI ...) instead of a digit+letter-suffix
// scheme (8L → 8M) — glPrefix() above can't relate "IX" to "X" at all since
// neither has a leading digit, so without this, that whole series of GLs
// would always get ADDED as new active entries and never get the predecessor
// auto-archived/superseded.
function romanToInt(s) {
  if (!/^[IVXLCDM]+$/i.test(s)) return null;
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const up = s.toUpperCase();
  let total = 0;
  for (let i = 0; i < up.length; i++) {
    const cur = map[up[i]], next = map[up[i + 1]];
    total += next && cur < next ? -cur : cur;
  }
  return total;
}

// Add a missing `expires` field onto the single-line entry for `number`
// (e.g. "GL X") in itemsText, if that entry exists and doesn't already carry
// one. Returns { text, changed }. Tier 1 below only writes `expires` for
// entries it INSERTS — a GL already in the curated library before this field
// existed (e.g. Iran's older rolling petroleum GLs) would otherwise show a
// permanently blank "Expires" column forever, even once OFAC's page (and our
// scraper) clearly has the date. Never touches a line that already has an
// expires field — existing/manually-curated data always wins.
function backfillExpires(itemsText, number, expiresVal) {
  const lines = itemsText.split("\n");
  let changed = false;
  const newLines = lines.map((line) => {
    if (changed || !line.includes(`number: "GL ${number}"`) || line.includes("expires:")) return line;
    const m = /\}\s*,?\s*$/.exec(line);
    if (!m) return line;
    changed = true;
    return line.slice(0, m.index) + `, expires: "${esc(expiresVal)}"` + line.slice(m.index);
  });
  return { text: newLines.join("\n"), changed };
}

// Recompute a leading "// N GLs ..." comment to match the new entry count, if present.
function refreshCountComment(itemsText) {
  const count = (itemsText.match(/\{\s*number:/g) || []).length;
  return itemsText.replace(/(\/\/\s*)\d+(\s*GLs?\b)/, `$1${count}$2`);
}

// ── Tier 1 guard: detect a GL that textually belongs to a DIFFERENT program ─
// OFAC genuinely cross-lists certain "headline" GLs on more than one program's
// page — e.g. Russia-related GL 134C (a crude-oil wind-down license) appears
// in the General Licenses section of Iran's page too, and Iran's GL X showed
// up on Russia-HFA's, Ukraine's, and Non-Proliferation's pages as well. The
// scraper has no way to avoid picking these up (it reads whatever a program's
// own page lists), but blindly treating "appears on this page" as "belongs to
// this program" duplicated the same GL into 4-5 unrelated program blocks in
// production, each with a different garbled scraped date (the date/expires
// regexes grabbed whatever nearby text happened to be on that page). Guard
// against it here: if a GL's title doesn't name THIS program but does name a
// different known program, skip it and log a note instead of inserting it.
function tokenize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
}
function stemMatch(a, b) {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5) return a.slice(0, 5) === b.slice(0, 5);
  return false;
}
function anyStemMatch(toksA, toksB) {
  return toksA.some((a) => toksB.some((b) => stemMatch(a, b)));
}
function crossProgramMismatch(glTitle, ownMeta, allMetas) {
  const titleToks = tokenize(glTitle).filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  if (titleToks.length === 0) return null; // nothing to go on — don't guess
  const ownToks = nameTokens(ownMeta?.name);
  if (ownToks.length > 0 && anyStemMatch(titleToks, ownToks)) return null; // title names this program
  for (const m of allMetas || []) {
    if (!m || m === ownMeta) continue;
    const toks = nameTokens(m.name);
    if (toks.length > 0 && anyStemMatch(titleToks, toks)) return m.name;
  }
  return null; // doesn't clearly name anyone else either — don't guess, let it through
}

// ── Tier 1: sync GL / EO entries for one block against scraped program data ─
function syncBlockEntries(blockText, scraped, log, ownMeta, allMetas) {
  const notes = [];
  if (!scraped) return { text: blockText, changed: false, notes };

  const { beforeArchive, archiveText, afterArchive } = splitArchive(blockText);
  let before = beforeArchive;
  let archive = archiveText; // string or null — never reassign null → non-null (no archive creation)
  let changed = false;

  // ---- General Licenses (with supersession-aware archiving) ----
  const activeGL = findArray(before, "generalLicenses");
  if (activeGL) {
    let activeItems = activeGL.itemsText;
    const archiveGL = archive ? findArray(archive, "generalLicenses") : null;
    let archiveItems = archiveGL ? archiveGL.itemsText : null;

    // Backfill `expires` onto already-existing active entries that don't have
    // it yet but have a known expiration date in this run's scrape — runs
    // regardless of whether any genuinely new GL also shows up below.
    let backfilledAny = false;
    for (const gl of scraped.generalLicenses || []) {
      if (!gl.number || !gl.expires) continue;
      const result = backfillExpires(activeItems, gl.number, gl.expires);
      if (result.changed) {
        activeItems = result.text;
        backfilledAny = true;
        notes.push(`Backfilled expires="${gl.expires}" onto existing GL ${gl.number}`);
      }
    }

    const known = new Set([...extractNumbers(activeItems), ...(archiveItems !== null ? extractNumbers(archiveItems) : [])]);
    const candidateGLs = (scraped.generalLicenses || []).filter((gl) => gl.number && !known.has(`GL ${gl.number}`));
    const newGLs = [];
    for (const gl of candidateGLs) {
      const mismatch = crossProgramMismatch(gl.title, ownMeta, allMetas);
      if (mismatch) {
        notes.push(`Skipped GL ${gl.number} ("${gl.title}") — title names "${mismatch}", not ${ownMeta?.name || "this program"}; likely an OFAC cross-listing on this page, not a genuinely new GL for this program`);
        continue;
      }
      newGLs.push(gl);
    }

    if (newGLs.length > 0) {
      for (const gl of newGLs) {
        const prefix = glPrefix(gl.number);
        const re = new RegExp(`number:\\s*"GL (${prefix}[A-Za-z]*)"`, "g");
        let m, predecessor = null;
        while ((m = re.exec(activeItems)) !== null) {
          if (m[1] !== gl.number) predecessor = m[1];
        }
        // Fallback: pure Roman-numeral series (no leading digit at all, so the
        // prefix match above can never fire) — find an active GL whose number
        // is the immediately preceding Roman numeral value.
        if (!predecessor) {
          const newVal = romanToInt(gl.number);
          if (newVal) {
            const reRoman = /number:\s*"GL ([IVXLCDM]+)"/gi;
            let rm;
            while ((rm = reRoman.exec(activeItems)) !== null) {
              if (romanToInt(rm[1]) === newVal - 1) predecessor = rm[1];
            }
          }
        }
        if (predecessor) {
          if (archiveItems !== null) {
            // Capture the predecessor's issued `date` too (not just title) so the
            // archived entry preserves "Issued Date" instead of losing it — the
            // archive table in AppContent.tsx shows License #/Title/Issued
            // Date/Expired Date as separate columns, so the original issue date
            // needs to survive the move into archive{}.
            const titleM = new RegExp(`number:\\s*"GL ${predecessor}",\\s*title:\\s*"([^"]*)"(?:,\\s*date:\\s*"([^"]*)")?`).exec(activeItems);
            const removed = removeEntryLine(activeItems, `GL ${predecessor}`);
            activeItems = removed.text;
            const archIndent = entryIndentOf(archiveItems) || "        ";
            const dateField = titleM?.[2] ? `date: "${esc(titleM[2])}", ` : "";
            const archivedLine = `${archIndent}{ number: "GL ${predecessor}", title: "${esc(titleM?.[1] || "")}", ${dateField}archived: true, archivedNote: "Superseded by General License ${esc(gl.number)}", archivedDate: "${esc(gl.date)}" },\n`;
            archiveItems = insertAtTop(archiveItems, archivedLine);
            notes.push(`Archived GL ${predecessor} → superseded by GL ${gl.number}`);
          } else {
            notes.push(`GL ${predecessor} superseded by GL ${gl.number} but program has no archive{} block — left active, needs manual archiving`);
          }
        }
      }
      const indent = entryIndentOf(activeItems);
      let adds = "";
      for (const gl of newGLs) {
        const expiresField = gl.expires ? `, expires: "${esc(gl.expires)}"` : "";
        adds += `${indent}{ number: "GL ${esc(gl.number)}", title: "${esc(gl.title)}", date: "${esc(gl.date)}", url: "${esc(gl.url)}"${expiresField}, addedDate: "${today()}" },\n`;
      }
      activeItems = insertAtTop(activeItems, adds);
      activeItems = refreshCountComment(activeItems);
    }

    if (newGLs.length > 0 || backfilledAny) {
      changed = true;
      before = replaceArray(before, activeGL, activeItems);
      if (archiveGL && archiveItems !== archiveGL.itemsText) {
        archive = replaceArray(archive, archiveGL, archiveItems);
      }
    }
  }

  // ---- Executive Orders (append-only — OFAC EOs aren't superseded like GLs) ----
  const activeEO = findArray(before, "executiveOrders");
  if (activeEO) {
    const archiveEO = archive ? findArray(archive, "executiveOrders") : null;
    const known = new Set([...extractNumbers(activeEO.itemsText), ...(archiveEO ? extractNumbers(archiveEO.itemsText) : [])]);
    const newEOs = (scraped.executiveOrders || []).filter((eo) => eo.number && !known.has(eo.number));
    if (newEOs.length > 0) {
      const indent = entryIndentOf(activeEO.itemsText);
      let adds = "";
      for (const eo of newEOs) {
        adds += `${indent}{ number: "${esc(eo.number)}", title: "${esc(eo.title)}", date: "${esc(eo.date)}", url: "${esc(eo.url)}", addedDate: "${today()}" },\n`;
      }
      const newItems = insertAtTop(activeEO.itemsText, adds);
      before = replaceArray(before, findArray(before, "executiveOrders"), newItems);
      changed = true;
    }
  }

  if (!changed) return { text: blockText, changed: false, notes };

  if (scraped.lastUpdated) {
    before = before.replace(/lastUpdated:\s*"[^"]*"/, `lastUpdated: "${esc(scraped.lastUpdated)}"`);
  }

  const finalText = before + (archive ?? "") + afterArchive;
  return { text: finalText, changed: true, notes };
}

// ── Tier 2: best-effort designation/advisory matching from recent actions ───
const STOPWORDS = new Set(["sanctions", "related", "the", "and", "of", "united", "states", "country", "information"]);

function nameTokens(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

const SIGNAL_RE = /designat|blocks?\b|sanction|prohibit|sdn list/i;

function syncAdvisories(blocks, metas, recentActions, log) {
  let changedAny = false;

  for (const action of recentActions || []) {
    if (!SIGNAL_RE.test(action.title || "")) continue;
    const titleLower = (action.title || "").toLowerCase();

    const matchIdxs = [];
    for (let i = 0; i < blocks.length; i++) {
      const meta = metas[i];
      if (!meta) continue;
      const toks = nameTokens(meta.name);
      if (toks.length > 0 && toks.some((t) => titleLower.includes(t))) matchIdxs.push(i);
    }
    if (matchIdxs.length !== 1) continue; // ambiguous or no match — skip, don't guess

    const i = matchIdxs[0];
    const ka = findArray(blocks[i].text, "keyAdvisories");
    if (!ka) continue; // only append where the field already exists

    const existingUrls = extractUrls(ka.itemsText);
    if (action.url && existingUrls.has(action.url)) continue; // already linked

    const indent = entryIndentOf(ka.itemsText) || "      ";
    const newLine = `${indent}{ title: "${esc(action.title)}", date: "${esc(action.date)}", url: "${esc(action.url)}", addedDate: "${today()}" },\n`;
    const newItems = insertAtTop(ka.itemsText, newLine);
    blocks[i].text = replaceArray(blocks[i].text, ka, newItems);
    changedAny = true;
    log(`[sync-programs] Tier 2: linked "${(action.title || "").slice(0, 80)}" → ${metas[i].id}.keyAdvisories`);
  }
  return changedAny;
}

// ── Top-level entry point ────────────────────────────────────────────────────
export async function syncProgramsLibrary({ programs, recentActions, githubToken, githubRepo, dryRun, log = console.log }) {
  if (!githubToken || !githubRepo) {
    log("[sync-programs] Missing GITHUB_TOKEN/GITHUB_REPOSITORY — skipping");
    return { changed: false };
  }
  if (!programs || Object.keys(programs).length === 0) {
    log("[sync-programs] No scraped program data this run — nothing to sync");
    return { changed: false };
  }

  let file;
  try {
    file = await getFile(githubRepo, githubToken, LIB_PATH);
  } catch (e) {
    log(`[sync-programs] Could not load ${LIB_PATH}: ${e.message} — aborting sync`);
    return { changed: false, error: e.message };
  }

  let blocks;
  try {
    blocks = splitProgramBlocks(file.content);
  } catch (e) {
    log(`[sync-programs] Could not parse program blocks: ${e.message} — aborting sync (file untouched)`);
    return { changed: false, error: e.message };
  }

  const originalBlockCount = blocks.length;
  const metas = blocks.map((b) => getBlockMeta(b.text));
  const summary = [];
  let anyChanged = false;

  for (let i = 0; i < blocks.length; i++) {
    const meta = metas[i];
    if (!meta) continue;
    const scraped = programs[meta.slug];
    if (!scraped) continue;
    const result = syncBlockEntries(blocks[i].text, scraped, log, meta, metas);
    if (result.changed) {
      blocks[i].text = result.text;
      anyChanged = true;
      summary.push(`${meta.id} GL/EO`);
      (result.notes || []).forEach((n) => log(`[sync-programs] ${meta.id}: ${n}`));
    }
  }

  if (syncAdvisories(blocks, metas, recentActions, log)) {
    anyChanged = true;
    summary.push("advisories linked");
  }

  if (!anyChanged) {
    log("[sync-programs] No new GL/EO/advisory entries detected — nothing to commit");
    return { changed: false };
  }

  // ---- Reassemble the full file from the (possibly edited) blocks ----
  const exportIdx = file.content.indexOf("export const SANCTIONS_PROGRAMS");
  const arrOpen = findProgramsArrayOpen(file.content, exportIdx);
  const arrClose = matchBracket(file.content, arrOpen);
  const body = file.content.slice(arrOpen + 1, arrClose - 1);
  const bodyOffset = arrOpen + 1;

  let newBody = "";
  let cursor = 0;
  for (const b of blocks) {
    const relStart = b.start - bodyOffset;
    const relEnd = b.end - bodyOffset;
    newBody += body.slice(cursor, relStart) + b.text;
    cursor = relEnd;
  }
  newBody += body.slice(cursor);

  const newContent = file.content.slice(0, arrOpen + 1) + newBody + file.content.slice(arrClose - 1);

  // ---- Sanity checks — abort rather than write anything questionable ----
  const balanced = (s, a, b) => (s.match(new RegExp(`\\${a}`, "g")) || []).length === (s.match(new RegExp(`\\${b}`, "g")) || []).length;
  if (!balanced(newContent, "{", "}") || !balanced(newContent, "[", "]")) {
    log("[sync-programs] SANITY CHECK FAILED: bracket imbalance after edit — aborting, nothing written");
    return { changed: false, error: "bracket imbalance" };
  }
  let recheckedBlocks;
  try {
    recheckedBlocks = splitProgramBlocks(newContent);
  } catch (e) {
    log(`[sync-programs] SANITY CHECK FAILED: could not re-parse edited file (${e.message}) — aborting, nothing written`);
    return { changed: false, error: e.message };
  }
  if (recheckedBlocks.length !== originalBlockCount) {
    log(`[sync-programs] SANITY CHECK FAILED: block count changed (${originalBlockCount} → ${recheckedBlocks.length}) — aborting, nothing written`);
    return { changed: false, error: "block count mismatch" };
  }
  // NOTE: the SANCTIONS_PROGRAMS array close is NOT necessarily the end of the
  // file (helper functions like getProgramById live after it) — so this check
  // must anchor on the array boundary itself, not end-of-string. By construction,
  // everything after the array's closing "]" was copied verbatim from the
  // original (file.content.slice(arrClose - 1)), so a length-accounting check
  // confirms nothing outside the array body was touched.
  if (!newContent.includes("export const SANCTIONS_PROGRAMS")) {
    log("[sync-programs] SANITY CHECK FAILED: export statement missing after edit — aborting, nothing written");
    return { changed: false, error: "structure check failed" };
  }
  const expectedDelta = newBody.length - body.length;
  if (newContent.length !== file.content.length + expectedDelta) {
    log(`[sync-programs] SANITY CHECK FAILED: unexpected content length after edit (expected delta ${expectedDelta}) — aborting, nothing written`);
    return { changed: false, error: "structure check failed" };
  }

  const message = `chore(programs): sync ${summary.join(", ")} from OFAC scrape [skip ci]`;
  if (dryRun) {
    log(`[sync-programs] DRY RUN — would commit: ${message}`);
    return { changed: true, dryRun: true, summary };
  }

  try {
    await putFile(githubRepo, githubToken, LIB_PATH, newContent, file.sha, message);
    log(`[sync-programs] ✅ Committed: ${message}`);
  } catch (e) {
    log(`[sync-programs] Commit failed: ${e.message}`);
    return { changed: false, error: e.message };
  }

  return { changed: true, summary };
}
