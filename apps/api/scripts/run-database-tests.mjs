import "dotenv/config";
import { spawnSync } from "node:child_process";

const developmentDatabaseName = "saas_dev";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function selectTestDatabaseUrl() {
  const configuredTestUrl = process.env.DATABASE_TEST_URL;
  const configuredUrl = configuredTestUrl || process.env.DATABASE_URL;
  if (!configuredUrl) {
    throw new Error("DATABASE_TEST_URL or DATABASE_URL is required");
  }

  const url = new URL(configuredUrl);
  const databaseName = url.pathname.slice(1);
  if (databaseName.endsWith("_test")) return url.toString();

  if (
    !configuredTestUrl &&
    localHosts.has(url.hostname) &&
    databaseName === developmentDatabaseName
  ) {
    url.pathname = "/saas_test";
    return url.toString();
  }

  throw new Error(
    "Refusing to run database tests: DATABASE_TEST_URL must name a database ending in _test. " +
      "Automatic selection is allowed only when DATABASE_URL points to local saas_dev.",
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = selectTestDatabaseUrl();
console.log(
  `Database test safety check passed for ${new URL(process.env.DATABASE_URL).pathname.slice(1)}.`,
);

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
run(pnpm, ["exec", "prisma", "migrate", "deploy"]);
run(pnpm, [
  "exec",
  "vitest",
  "run",
  "test/database.integration.test.ts",
  "--maxWorkers=1",
  "--no-file-parallelism",
]);
