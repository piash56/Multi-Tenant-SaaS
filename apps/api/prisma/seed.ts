import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const url = new URL(databaseUrl);
if (process.env.NODE_ENV === "production" || url.pathname.slice(1) !== "saas_dev") {
  throw new Error("Development seed is allowed only for the saas_dev database outside production.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  const organization = await prisma.organization.upsert({
    where: { slug: "demo-acme" },
    update: { name: "Demo Acme" },
    create: { name: "Demo Acme", slug: "demo-acme", timezone: "Asia/Dhaka" },
  });
  const user = await prisma.user.upsert({
    where: { normalizedEmail: "moderator@example.test" },
    update: { email: "moderator@example.test" },
    create: { email: "moderator@example.test", normalizedEmail: "moderator@example.test" },
  });
  const membership = await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
    update: { displayName: "Demo Moderator", status: "ACTIVE" },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "MODERATOR",
      status: "ACTIVE",
      displayName: "Demo Moderator",
      joinedAt: new Date(),
    },
  });
  const account = await prisma.connectedChannelAccount.upsert({
    where: {
      platform_providerAccountId: {
        platform: "FACEBOOK_MESSENGER",
        providerAccountId: "demo-page-001",
      },
    },
    update: { displayName: "Demo Facebook Page" },
    create: {
      organizationId: organization.id,
      platform: "FACEBOOK_MESSENGER",
      providerAccountId: "demo-page-001",
      displayName: "Demo Facebook Page",
      status: "PENDING",
    },
  });
  const contact = await prisma.contact.upsert({
    where: {
      organizationId_id: {
        organizationId: organization.id,
        id: "00000000-0000-4000-8000-000000000101",
      },
    },
    update: { displayName: "Synthetic Customer" },
    create: {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: organization.id,
      displayName: "Synthetic Customer",
    },
  });
  await prisma.conversation.upsert({
    where: {
      connectedChannelAccountId_providerThreadKey: {
        connectedChannelAccountId: account.id,
        providerThreadKey: "demo-thread-001",
      },
    },
    update: { currentAssigneeMembershipId: membership.id },
    create: {
      organizationId: organization.id,
      connectedChannelAccountId: account.id,
      contactId: contact.id,
      providerThreadKey: "demo-thread-001",
      currentAssigneeMembershipId: membership.id,
    },
  });
  console.log("Development seed completed idempotently.");
} finally {
  await prisma.$disconnect();
}
