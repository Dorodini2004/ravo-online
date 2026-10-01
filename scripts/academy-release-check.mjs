import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { emptyStore } from "../src/academy/logic.mjs";

// Scan only deliverable files; never read users' browser profiles or credentials.
const roots = ["src", "public", ".next/static", ".next/server/app"];
const deniedNames =
  /(^|\/)(\.env[^/]*|[^/]*\.(pem|key|sqlite|db|zip|log))$|trading-basics-.*\.json$|academy-rohdaten\.json$|academy-.*\.png$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /AKIA[0-9A-Z]{16}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{35,}/,
];
const testMarkers = [
  "OHLC verstanden",
  "Körper und Spanne sind unterschiedliche Größen.",
  "Drei Kerzen erklären.",
];
const issues = [];
let files = 0,
  textFiles = 0;
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scan(filename);
      continue;
    }
    files++;
    const name = filename.replaceAll("\\", "/");
    if (deniedNames.test(name))
      issues.push({
        file: name,
        reason: "Disallowed private/archive/test filename",
      });
    if (!/\.(js|jsx|ts|tsx|mjs|json|html|txt|css|map|svg)$/.test(name)) continue;
    textFiles++;
    const content = await readFile(filename, "utf8");
    if (secretPatterns.some((pattern) => pattern.test(content)))
      issues.push({
        file: name,
        reason: "Potential secret pattern (value intentionally not printed)",
      });
    if (testMarkers.some((marker) => content.includes(marker)))
      issues.push({
        file: name,
        reason: "Browser-test journal fixture found in build",
      });
  }
}
for (const root of roots) await scan(root);
for (const profile of Object.values(emptyStore().profiles))
  for (const values of Object.values(profile))
    assert.deepEqual(
      values,
      [],
      "New profile must contain no personal or demonstration learning data",
    );
const report = {
  checkedAt: new Date().toISOString(),
  roots,
  files,
  textFiles,
  emptyInitialProfiles: true,
  issues,
};
await writeFile(
  ".next/academy-release-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
assert.equal(
  issues.length,
  0,
  "Resolve release audit findings before publishing",
);
