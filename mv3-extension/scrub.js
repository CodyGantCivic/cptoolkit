#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "apikey",
  "api-key",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "password",
  "secret",
  "client_secret"
]);

function redactString(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED]")
    .replace(/([A-Za-z0-9+/._=-]{40,})/g, "[REDACTED_TOKEN]");
}

function sanitizeAny(value, parentKey) {
  if (value === null || value === undefined) return value;

  const lowerKey = String(parentKey || "").toLowerCase();
  if (SENSITIVE_KEYS.has(lowerKey)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAny(item, parentKey));
  }

  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeAny(v, k);
    }
    return out;
  }

  return value;
}

async function main() {
  const input = process.argv[2];
  const outputArg = process.argv[3];
  if (!input) {
    console.error("Usage: node scrub.js <capture.json> [output.json]");
    process.exit(1);
  }

  const inputPath = path.resolve(input);
  const outputPath = outputArg
    ? path.resolve(outputArg)
    : inputPath.replace(/\.json$/i, ".scrubbed.json");

  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const scrubbed = sanitizeAny(parsed, "");

  await fs.writeFile(outputPath, JSON.stringify(scrubbed, null, 2), "utf8");
  console.log(`Scrubbed file written: ${outputPath}`);
}

main().catch((error) => {
  console.error("Scrub failed:", error.message);
  process.exit(1);
});
