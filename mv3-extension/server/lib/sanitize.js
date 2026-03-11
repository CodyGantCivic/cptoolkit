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

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeAny(value, parentKey) {
  if (value === null || value === undefined) return value;

  const key = (parentKey || "").toLowerCase();
  if (SENSITIVE_KEYS.has(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAny(item, parentKey));
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const [k, v] of Object.entries(value)) {
      output[k] = sanitizeAny(v, k);
    }
    return output;
  }

  return value;
}

export function sanitizeCapture(capture) {
  return sanitizeAny(capture, "");
}

export function redactText(text) {
  return redactString(text);
}
