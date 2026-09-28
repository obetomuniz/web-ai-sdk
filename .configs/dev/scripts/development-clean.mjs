import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_ARTIFACTS = [
  ".astro",
  ".pnpm-store",
  ".turbo",
  "_site",
  "coverage",
  "dist",
  "node_modules",
  "storybook-static",
];

const WORKSPACE_ARTIFACTS = [
  ".astro",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "storybook-static",
];

const FIXED_ARTIFACTS = ["apps/mcp/.wrangler", "apps/mcp/src/generated"];

function isMissing(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}

function assertInsideRoot(root, target) {
  const relative = path.relative(root, target);

  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean a path outside the checkout: ${target}`);
  }

  return relative;
}

function listWorkspaceDirectories(root, scope) {
  const scopePath = path.join(root, scope);

  try {
    return fs
      .readdirSync(scopePath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(scopePath, entry.name));
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

export function collectDevelopmentArtifacts(root) {
  const resolvedRoot = path.resolve(root);
  const candidates = ROOT_ARTIFACTS.map((artifact) =>
    path.join(resolvedRoot, artifact),
  );

  for (const scope of ["apps", "packages"]) {
    for (const workspace of listWorkspaceDirectories(resolvedRoot, scope)) {
      for (const artifact of WORKSPACE_ARTIFACTS) {
        candidates.push(path.join(workspace, artifact));
      }
    }
  }

  for (const artifact of FIXED_ARTIFACTS) {
    candidates.push(path.join(resolvedRoot, artifact));
  }

  return candidates
    .filter((candidate) => {
      assertInsideRoot(resolvedRoot, candidate);

      try {
        fs.lstatSync(candidate);
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    })
    .sort((left, right) => right.length - left.length);
}

export function cleanDevelopmentArtifacts(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  const artifacts = collectDevelopmentArtifacts(resolvedRoot);

  if (!options.dryRun) {
    for (const artifact of artifacts) {
      fs.rmSync(artifact, { force: true, recursive: true });
    }
  }

  return artifacts.map((artifact) => path.relative(resolvedRoot, artifact));
}

function findDevelopmentRoot(start) {
  let current = path.resolve(start);

  while (true) {
    const packagePath = path.join(current, "package.json");
    const workspacePath = path.join(current, "pnpm-workspace.yaml");

    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

      if (packageJson.name === "web-ai-sdk" && fs.existsSync(workspacePath)) {
        return current;
      }
    } catch (error) {
      if (!isMissing(error) && !(error instanceof SyntaxError)) throw error;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Could not find the web-ai-sdk checkout root.");
    }
    current = parent;
  }
}

function parseOptions(args) {
  const options = args.filter((argument) => argument !== "--");
  const unknown = options.filter((argument) => argument !== "--dry-run");
  if (unknown.length > 0) {
    throw new Error(`Unknown option: ${unknown[0]}`);
  }

  return { dryRun: options.includes("--dry-run") };
}

function run() {
  const options = parseOptions(process.argv.slice(2));
  const root = findDevelopmentRoot(process.cwd());
  const artifacts = cleanDevelopmentArtifacts(root, options);
  const action = options.dryRun ? "Would remove" : "Removed";

  if (artifacts.length === 0) {
    console.log("No generated development artifacts found.");
    return;
  }

  console.log(`${action} ${artifacts.length} generated artifact paths:`);
  for (const artifact of artifacts.sort()) console.log(`- ${artifact}`);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) run();
