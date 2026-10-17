import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { hash, argon2id } from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    "password-file": { type: "string" },
    "generate-password": { type: "boolean", default: false },
    "credentials-file": { type: "string" },
    "organization-id": { type: "string" },
    role: { type: "string", default: "MODERATOR" },
    "display-name": { type: "string" },
    "super-admin": { type: "boolean", default: false },
    "approved-by": { type: "string" },
    "local-development": { type: "boolean", default: false },
  },
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !values.email || !values["display-name"]) {
  throw new Error("DATABASE_URL, --email, and --display-name are required");
}
const passwordSources = [
  Boolean(values.password),
  Boolean(values["password-file"]),
  values["generate-password"],
].filter(Boolean).length;
if (passwordSources !== 1) {
  throw new Error("Use exactly one of --password, --password-file, or --generate-password");
}
if (values["credentials-file"] && !values["generate-password"]) {
  throw new Error("--credentials-file requires --generate-password");
}
if (values["super-admin"] && !values["approved-by"]) {
  throw new Error(
    "Super Admin provisioning requires --approved-by for an auditable approval reference",
  );
}
if (values["super-admin"] && !values["local-development"]) {
  throw new Error("Super Admin provisioning requires the explicit --local-development safeguard");
}
if (!values["super-admin"] && !values["organization-id"]) {
  throw new Error("Organization users require --organization-id");
}

const roles = ["ORGANIZATION_ADMIN", "SUPERVISOR", "MODERATOR"] as const;
if (!roles.includes(values.role as (typeof roles)[number])) {
  throw new Error("Invalid organization role");
}

const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
if (
  values["local-development"] &&
  (process.env.NODE_ENV === "production" || databaseName !== "saas_dev")
) {
  throw new Error("Local-development provisioning is allowed only for saas_dev outside production");
}

const normalizedEmail = values.email.trim().toLowerCase();
const displayName = values["display-name"].trim();
if (!normalizedEmail || !displayName) throw new Error("Email and display name cannot be blank");

function generateStrongPassword(): string {
  return `${randomBytes(24).toString("base64url")}!9Aa`;
}

const password = values["generate-password"]
  ? generateStrongPassword()
  : values["password-file"]
    ? (await readFile(values["password-file"], "utf8")).replace(/[\r\n]+$/, "")
    : values.password!;
if (password.length < 12 || password.length > 128) {
  throw new Error("Password must be 12-128 characters");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
let credentialPath: string | undefined;

try {
  const existing = await prisma.user.findUnique({
    where: { normalizedEmail },
    select: { id: true },
  });
  if (existing) throw new Error(`Account already exists for ${normalizedEmail}; no changes made`);

  if (!values["super-admin"]) {
    const organization = await prisma.organization.findUnique({
      where: { id: values["organization-id"]! },
      select: { status: true, deletedAt: true },
    });
    if (!organization || organization.deletedAt || organization.status !== "ACTIVE") {
      throw new Error("The selected organization does not exist or is not active");
    }
  }

  if (values["generate-password"]) {
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const credentialRoot = path.join(repositoryRoot, ".local", "credentials");
    credentialPath = values["credentials-file"]
      ? path.resolve(values["credentials-file"])
      : path.join(credentialRoot, `${normalizedEmail.replace(/[^a-z0-9.-]/g, "_")}.txt`);
    const relativePath = path.relative(credentialRoot, credentialPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Generated credentials must be stored under .local/credentials");
    }
    await mkdir(path.dirname(credentialPath), { recursive: true });
    const credentialFile = await open(credentialPath, "wx", 0o600);
    try {
      await credentialFile.writeFile(
        `Local development account\nEmail: ${normalizedEmail}\nDisplay name: ${displayName}\nPassword: ${password}\n`,
        { encoding: "utf8" },
      );
      await credentialFile.sync();
    } finally {
      await credentialFile.close();
    }
  }

  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
  const user = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.user.findUnique({
      where: { normalizedEmail },
      select: { id: true },
    });
    if (duplicate)
      throw new Error(`Account already exists for ${normalizedEmail}; no changes made`);

    const created = await tx.user.create({
      data: {
        email: values.email!,
        normalizedEmail,
        displayName,
        passwordHash,
        status: "ACTIVE",
        platformRole: values["super-admin"] ? "SUPER_ADMIN" : "USER",
      },
    });
    if (values["super-admin"]) {
      await tx.auditLog.create({
        data: {
          actorUserId: created.id,
          action: "provision.super_admin",
          targetType: "USER",
          targetId: created.id,
          result: "SUCCESS",
          changes: {
            approvedBy: values["approved-by"],
            localDevelopment: values["local-development"],
          },
        },
      });
    } else {
      await tx.membership.create({
        data: {
          organizationId: values["organization-id"]!,
          userId: created.id,
          role: values.role as (typeof roles)[number],
          status: "ACTIVE",
          displayName,
          joinedAt: new Date(),
        },
      });
    }
    return created;
  });

  console.log(`Provisioned ${user.id} (${user.normalizedEmail})`);
  if (credentialPath) console.log(`Credentials saved to ${credentialPath}`);
} catch (error) {
  if (credentialPath) await unlink(credentialPath).catch(() => undefined);
  throw error;
} finally {
  await prisma.$disconnect();
}
