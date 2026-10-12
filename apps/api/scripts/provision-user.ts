import "dotenv/config";
import { parseArgs } from "node:util";
import { hash, argon2id } from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    "organization-id": { type: "string" },
    role: { type: "string", default: "MODERATOR" },
    "display-name": { type: "string" },
    "super-admin": { type: "boolean", default: false },
    "approved-by": { type: "string" },
  },
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !values.email || !values.password) {
  throw new Error("DATABASE_URL, --email, and --password are required");
}
if (values.password.length < 12 || values.password.length > 128) {
  throw new Error("Password must be 12-128 characters");
}
if (values["super-admin"] && !values["approved-by"]) {
  throw new Error(
    "Super Admin provisioning requires --approved-by for an auditable approval reference",
  );
}
if (!values["super-admin"] && (!values["organization-id"] || !values["display-name"])) {
  throw new Error("Organization users require --organization-id and --display-name");
}
const roles = ["ORGANIZATION_ADMIN", "SUPERVISOR", "MODERATOR"] as const;
if (!roles.includes(values.role as (typeof roles)[number]))
  throw new Error("Invalid organization role");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
try {
  const normalizedEmail = values.email.trim().toLowerCase();
  const passwordHash = await hash(values.password, {
    type: argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.upsert({
      where: { normalizedEmail },
      update: { email: values.email!, passwordHash, status: "ACTIVE" },
      create: {
        email: values.email!,
        normalizedEmail,
        passwordHash,
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
          changes: { approvedBy: values["approved-by"] },
        },
      });
    } else {
      await tx.membership.upsert({
        where: {
          organizationId_userId: { organizationId: values["organization-id"]!, userId: created.id },
        },
        update: {
          role: values.role as (typeof roles)[number],
          status: "ACTIVE",
          displayName: values["display-name"]!,
        },
        create: {
          organizationId: values["organization-id"]!,
          userId: created.id,
          role: values.role as (typeof roles)[number],
          status: "ACTIVE",
          displayName: values["display-name"]!,
          joinedAt: new Date(),
        },
      });
    }
    return created;
  });
  console.log(`Provisioned ${user.id} (${user.normalizedEmail})`);
} finally {
  await prisma.$disconnect();
}
