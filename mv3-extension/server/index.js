import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sanitizeCapture } from "./lib/sanitize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE_DIR = path.join(__dirname, "captures");
const HTTP_PORT = Number(process.env.CP_MCP_HTTP_PORT || 9001);
const START_HTTP = process.env.CP_MCP_DISABLE_HTTP !== "1";

await fs.mkdir(CAPTURE_DIR, { recursive: true });

function cleanId(raw) {
  return String(raw || "").replace(/[^a-zA-Z0-9._-]/g, "");
}

function captureFilePath(captureId) {
  return path.join(CAPTURE_DIR, `${captureId}.json`);
}

async function listCaptureFiles(limit = 20) {
  const entries = await fs.readdir(CAPTURE_DIR, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  const rows = [];
  for (const fileName of jsonFiles) {
    const fullPath = path.join(CAPTURE_DIR, fileName);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    rows.push({
      captureId: parsed.captureId || fileName.replace(/\.json$/, ""),
      generatedAt: parsed.generatedAt || null,
      tabUrl: parsed.tab && parsed.tab.url ? parsed.tab.url : null,
      eventCount: parsed.stats && typeof parsed.stats.eventCount === "number"
        ? parsed.stats.eventCount
        : Array.isArray(parsed.events)
          ? parsed.events.length
          : 0,
      fileName
    });
  }
  return rows;
}

async function readCapture(captureId) {
  const id = cleanId(captureId);
  if (!id) throw new Error("Invalid capture id");
  const raw = await fs.readFile(captureFilePath(id), "utf8");
  return JSON.parse(raw);
}

async function persistCapture(inputCapture) {
  const sanitized = sanitizeCapture(inputCapture);
  const requestedId = cleanId(sanitized.captureId);
  const captureId = requestedId || `cp-capture-${Date.now()}`;
  sanitized.captureId = captureId;
  sanitized.storedAt = new Date().toISOString();
  const raw = JSON.stringify(sanitized, null, 2);
  await fs.writeFile(captureFilePath(captureId), raw, "utf8");
  return {
    captureId,
    eventCount: Array.isArray(sanitized.events) ? sanitized.events.length : 0
  };
}

function networkEvents(capture) {
  if (!capture || !Array.isArray(capture.events)) return [];
  return capture.events.filter((event) => {
    if (!event || typeof event !== "object") return false;
    return (
      event.type === "network-request" ||
      event.type === "network-response" ||
      event.type === "network-error"
    );
  });
}

function requestMethod(event) {
  return event && event.payload && event.payload.method
    ? String(event.payload.method).toUpperCase()
    : null;
}

function requestUrl(event) {
  return event && event.payload && event.payload.requestUrl
    ? String(event.payload.requestUrl)
    : null;
}

function requestStatus(event) {
  if (!event || !event.payload) return null;
  const value = event.payload.status;
  if (typeof value !== "number") return null;
  return value;
}

function filterRequests(capture, options = {}) {
  const {
    urlContains = "",
    method = "",
    statusMin = null,
    statusMax = null,
    limit = 50
  } = options;

  const upperMethod = method ? String(method).toUpperCase() : "";
  const matches = [];

  for (const event of networkEvents(capture)) {
    if (event.type !== "network-request" && event.type !== "network-response" && event.type !== "network-error") {
      continue;
    }

    const url = requestUrl(event) || "";
    const eventMethod = requestMethod(event) || "";
    const status = requestStatus(event);

    if (urlContains && !url.includes(urlContains)) continue;
    if (upperMethod && eventMethod && upperMethod !== eventMethod) continue;
    if (statusMin !== null && status !== null && status < statusMin) continue;
    if (statusMax !== null && status !== null && status > statusMax) continue;

    matches.push({
      id: event.id || null,
      type: event.type || null,
      time: event.time || null,
      requestId: event.payload && event.payload.requestId ? event.payload.requestId : null,
      method: eventMethod || null,
      url: url || null,
      status
    });

    if (matches.length >= limit) break;
  }

  return matches;
}

function traceRequest(capture, options = {}) {
  const allEvents = Array.isArray(capture && capture.events) ? capture.events : [];
  if (!allEvents.length) return [];

  const requestId = options.requestId ? String(options.requestId) : null;
  const urlContains = options.urlContains ? String(options.urlContains) : null;

  if (!requestId && !urlContains) {
    return [];
  }

  return allEvents.filter((event) => {
    if (!event || !event.payload) return false;
    if (requestId && event.payload.requestId === requestId) return true;
    if (urlContains && event.payload.requestUrl && String(event.payload.requestUrl).includes(urlContains)) {
      return true;
    }
    return false;
  });
}

function startHttpCollector() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "30mb" }));

  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "cp-toolkit-mcp", time: new Date().toISOString() });
  });

  app.get("/captures", async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
      const captures = await listCaptureFiles(limit);
      res.json({ ok: true, captures });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/captures/:id", async (req, res) => {
    try {
      const capture = await readCapture(req.params.id);
      res.json({ ok: true, capture });
    } catch (error) {
      res.status(404).json({ ok: false, error: error.message });
    }
  });

  app.post("/collect", async (req, res) => {
    try {
      const payload = req.body && req.body.capture ? req.body.capture : req.body;
      if (!payload || typeof payload !== "object") {
        res.status(400).json({ ok: false, error: "Body must include a capture object" });
        return;
      }
      const stored = await persistCapture(payload);
      res.json({ ok: true, captureId: stored.captureId, eventCount: stored.eventCount });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.listen(HTTP_PORT, () => {
    console.error(`[cp-mcp] HTTP collector listening on http://localhost:${HTTP_PORT}`);
  });
}

const mcp = new McpServer({
  name: "cp-toolkit-capture-server",
  version: "0.1.0"
});

mcp.registerTool(
  "list_captures",
  {
    title: "List captures",
    description: "List locally stored toolkit capture files.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional()
    }
  },
  async ({ limit = 20 }) => {
    const captures = await listCaptureFiles(limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ captures }, null, 2)
        }
      ]
    };
  }
);

mcp.registerTool(
  "get_capture",
  {
    title: "Get capture",
    description: "Load a capture by captureId.",
    inputSchema: {
      captureId: z.string().min(1)
    }
  },
  async ({ captureId }) => {
    const capture = await readCapture(captureId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(capture, null, 2)
        }
      ]
    };
  }
);

mcp.registerTool(
  "find_requests",
  {
    title: "Find requests",
    description: "Find network request/response/error events inside a capture.",
    inputSchema: {
      captureId: z.string().min(1),
      urlContains: z.string().optional(),
      method: z.string().optional(),
      statusMin: z.number().int().optional(),
      statusMax: z.number().int().optional(),
      limit: z.number().int().min(1).max(200).optional()
    }
  },
  async ({ captureId, urlContains, method, statusMin, statusMax, limit = 50 }) => {
    const capture = await readCapture(captureId);
    const matches = filterRequests(capture, { urlContains, method, statusMin, statusMax, limit });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ captureId, matches }, null, 2)
        }
      ]
    };
  }
);

mcp.registerTool(
  "trace_request",
  {
    title: "Trace request",
    description: "Trace all events tied to a requestId or URL match.",
    inputSchema: {
      captureId: z.string().min(1),
      requestId: z.string().optional(),
      urlContains: z.string().optional()
    }
  },
  async ({ captureId, requestId, urlContains }) => {
    const capture = await readCapture(captureId);
    const events = traceRequest(capture, { requestId, urlContains });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ captureId, requestId, urlContains, events }, null, 2)
        }
      ]
    };
  }
);

if (START_HTTP) {
  startHttpCollector();
}

const transport = new StdioServerTransport();
await mcp.connect(transport);
console.error("[cp-mcp] MCP stdio server ready");
