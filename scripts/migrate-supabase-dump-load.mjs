#!/usr/bin/env node
/**
 * Dump old Supabase → load new (preserve UUIDs).
 *
 * Usage:
 *   OLD_URL=... OLD_KEY=... NEW_URL=... NEW_KEY=... \
 *     node scripts/migrate-supabase-dump-load.mjs [--dump-only|--load-only|--verify]
 *
 * Dump artifacts: /tmp/gmp-supabase-migrate/dump/*.json (outside git)
 *
 * FK-safe order per plan 23-Infra-Hermes-Migration-Plan.
 * Skips empty tables. Upserts by primary key `id`.
 */

import fs from "node:fs";
import path from "node:path";

const DUMP_DIR = process.env.DUMP_DIR || "/tmp/gmp-supabase-migrate/dump";
const PAGE = 500;

/** @type {string[]} */
const TABLES = [
  "organizations",
  "shows",
  "show_context",
  "hosts",
  "profiles",
  "org_members",
  "episodes",
  "docket_topics",
  "docket_votes",
  "docket_comments",
  "research_briefs",
  "runsheets",
  "hooks",
  "episode_slides",
  "transcripts",
  "repurpose_outputs",
  "newsletters",
  "source_videos",
  "clips",
  "mashup_outputs",
  "thumbnail_outputs",
  "guests",
  "activity_log",
  "jobs",
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function headers(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

async function countRows(baseUrl, key, table) {
  const r = await fetch(`${baseUrl}/rest/v1/${table}?select=id`, {
    method: "HEAD",
    headers: {
      ...headers(key),
      Prefer: "count=exact",
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`count ${table}: ${r.status}`);
  const cr = r.headers.get("content-range") || "";
  const m = cr.match(/\/(\d+|\*)/);
  if (!m || m[1] === "*") return 0;
  return Number(m[1]);
}

async function fetchAll(baseUrl, key, table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE - 1;
    const r = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, {
      headers: {
        ...headers(key),
        Range: `${from}-${to}`,
        Prefer: "count=exact",
      },
    });
    if (r.status === 404) return null;
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`fetch ${table} ${from}-${to}: ${r.status} ${body}`);
    }
    const chunk = await r.json();
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function upsertBatch(baseUrl, key, table, batch) {
  if (!batch.length) return;
  const r = await fetch(`${baseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...headers(key),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(batch),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`upsert ${table} (${batch.length}): ${r.status} ${body}`);
  }
}

function writeDump(table, rows) {
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  const p = path.join(DUMP_DIR, `${table}.json`);
  fs.writeFileSync(p, JSON.stringify(rows));
  return p;
}

function readDump(table) {
  const p = path.join(DUMP_DIR, `${table}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function dump() {
  const url = requireEnv("OLD_URL");
  const key = requireEnv("OLD_KEY");
  console.log(`Dumping from ${url} → ${DUMP_DIR}`);
  const summary = {};
  for (const table of TABLES) {
    const rows = await fetchAll(url, key, table);
    if (rows === null) {
      console.log(`  ${table}: MISSING (skip)`);
      summary[table] = null;
      continue;
    }
    writeDump(table, rows);
    console.log(`  ${table}: ${rows.length}`);
    summary[table] = rows.length;
  }
  fs.writeFileSync(
    path.join(DUMP_DIR, "_summary.json"),
    JSON.stringify(summary, null, 2)
  );
  return summary;
}

async function load() {
  const url = requireEnv("NEW_URL");
  const key = requireEnv("NEW_KEY");
  console.log(`Loading into ${url} from ${DUMP_DIR}`);
  const summary = {};
  for (const table of TABLES) {
    const rows = readDump(table);
    if (!rows) {
      console.log(`  ${table}: no dump file (skip)`);
      summary[table] = null;
      continue;
    }
    if (!rows.length) {
      console.log(`  ${table}: 0`);
      summary[table] = 0;
      continue;
    }
    for (let i = 0; i < rows.length; i += PAGE) {
      const batch = rows.slice(i, i + PAGE);
      await upsertBatch(url, key, table, batch);
    }
    console.log(`  ${table}: ${rows.length}`);
    summary[table] = rows.length;
  }
  return summary;
}

async function verify() {
  const oldUrl = requireEnv("OLD_URL");
  const oldKey = requireEnv("OLD_KEY");
  const newUrl = requireEnv("NEW_URL");
  const newKey = requireEnv("NEW_KEY");
  console.log("Verify row counts old vs new");
  let ok = true;
  for (const table of TABLES) {
    const a = await countRows(oldUrl, oldKey, table);
    const b = await countRows(newUrl, newKey, table);
    const match = a === b;
    if (!match) ok = false;
    console.log(`  ${table}: old=${a} new=${b} ${match ? "OK" : "MISMATCH"}`);
  }
  if (!ok) process.exitCode = 1;
}

const mode = process.argv[2] || "--all";

(async () => {
  if (mode === "--dump-only") await dump();
  else if (mode === "--load-only") await load();
  else if (mode === "--verify") await verify();
  else if (mode === "--all") {
    await dump();
    await load();
    await verify();
  } else {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
