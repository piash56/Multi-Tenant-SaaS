import "dotenv/config";

const value = process.env.DATABASE_URL;
if (!value) throw new Error("DATABASE_URL is required");

const url = new URL(value);
const databaseName = url.pathname.slice(1);
if (process.env.NODE_ENV !== "test" || !databaseName.endsWith("_test")) {
  throw new Error(
    `Database tests require NODE_ENV=test and a database ending in _test; received ${databaseName || "<empty>"}.`,
  );
}

console.log(`Database test safety check passed for ${databaseName}.`);
