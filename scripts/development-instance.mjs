import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_OVERRIDE_VARIABLE = "WEB_AI_SDK_DEV_INSTANCE";
const HOST_OVERRIDE_VARIABLE = "WEB_AI_SDK_HOST";
const MAX_OVERRIDE_LENGTH = 32;
const MAX_SLUG_LENGTH = 18;
const PORT_SLOT_COUNT = 5_000;

const SERVICE_DEFINITIONS = Object.freeze({
  site: Object.freeze({
    defaultPort: 5_173,
    isolatedPortBase: 20_000,
    portVariable: "WEB_AI_SDK_SITE_PORT",
  }),
  preview: Object.freeze({
    defaultPort: 4_173,
    isolatedPortBase: 30_000,
    portVariable: "WEB_AI_SDK_PREVIEW_PORT",
  }),
  mcp: Object.freeze({
    defaultPort: 8_787,
    isolatedPortBase: 40_000,
    portVariable: "WEB_AI_SDK_MCP_PORT",
  }),
  mcpInspector: Object.freeze({
    allowZero: true,
    defaultPort: 9_229,
    isolatedPortBase: 50_000,
    portVariable: "WEB_AI_SDK_MCP_INSPECTOR_PORT",
  }),
});

export function normalizeDevelopmentInstanceId(
  value,
  maximumLength = MAX_OVERRIDE_LENGTH,
) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximumLength)
    .replace(/-+$/g, "");
}

function canonicalCheckoutRoot(root) {
  const resolved = fs.realpathSync.native(path.resolve(root));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isPrimaryCheckout(root) {
  try {
    return fs.statSync(path.join(root, ".git")).isDirectory();
  } catch {
    return false;
  }
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function derivedWorktreeIdentity(canonicalRoot) {
  const slug =
    normalizeDevelopmentInstanceId(
      path.basename(canonicalRoot),
      MAX_SLUG_LENGTH,
    ) || "worktree";
  const pathHash = hash(canonicalRoot);

  return {
    id: `${slug}-${pathHash.slice(0, 8)}`,
    portSlot: Number.parseInt(pathHash.slice(0, 8), 16) % PORT_SLOT_COUNT,
  };
}

function overrideIdentity(override) {
  const id = normalizeDevelopmentInstanceId(override);

  if (!id || id === DEFAULT_INSTANCE_ID) {
    throw new Error(
      `${INSTANCE_OVERRIDE_VARIABLE} must normalize to a non-reserved identifier.`,
    );
  }

  return {
    id,
    portSlot: Number.parseInt(hash(id).slice(0, 8), 16) % PORT_SLOT_COUNT,
  };
}

export function resolveDevelopmentInstance(root, environment = process.env) {
  const canonicalRoot = canonicalCheckoutRoot(root);
  const override = environment[INSTANCE_OVERRIDE_VARIABLE];
  let identity;
  let source;

  if (override !== undefined && String(override).trim() !== "") {
    identity = overrideIdentity(override);
    source = "override";
  } else if (isPrimaryCheckout(canonicalRoot)) {
    identity = { id: DEFAULT_INSTANCE_ID, portSlot: 0 };
    source = "primary-checkout";
  } else {
    identity = derivedWorktreeIdentity(canonicalRoot);
    source = "linked-worktree";
  }

  return Object.freeze({
    id: identity.id,
    portSlot: identity.portSlot,
    primary: identity.id === DEFAULT_INSTANCE_ID,
    root: canonicalRoot,
    source,
  });
}

function parsePort(value, variable, allowZero = false) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const minimum = allowZero ? 0 : 1;
  const message = `${variable} must be an integer from ${minimum} through 65535.`;

  if (!/^\d+$/.test(normalized)) {
    throw new Error(message);
  }

  const port = Number(normalized);

  if (port < minimum || port > 65_535) {
    throw new Error(message);
  }

  return port;
}

export function resolveDevelopmentService(
  service,
  root,
  environment = process.env,
) {
  const definition = SERVICE_DEFINITIONS[service];

  if (!definition) {
    throw new Error(`Unknown development service: ${service}`);
  }

  const instance = resolveDevelopmentInstance(root, environment);
  const configuredPort = parsePort(
    environment[definition.portVariable],
    definition.portVariable,
    definition.allowZero,
  );
  const configuredHost = environment[HOST_OVERRIDE_VARIABLE]?.trim() || null;
  const port =
    configuredPort ??
    (instance.primary
      ? definition.defaultPort
      : definition.isolatedPortBase + instance.portSlot);
  const hostname = instance.primary
    ? "localhost"
    : `${service}--${instance.id}.web-ai-sdk.localhost`;

  return Object.freeze({
    bindHost: configuredHost ?? (instance.primary ? null : "127.0.0.1"),
    configured: configuredPort !== null || configuredHost !== null,
    hostname,
    instance,
    port,
    portVariable: definition.portVariable,
    url: `http://${hostname}:${port}/`,
  });
}

export const developmentInstanceConstants = Object.freeze({
  defaultInstanceId: DEFAULT_INSTANCE_ID,
  hostOverrideVariable: HOST_OVERRIDE_VARIABLE,
  instanceOverrideVariable: INSTANCE_OVERRIDE_VARIABLE,
  portSlotCount: PORT_SLOT_COUNT,
});
