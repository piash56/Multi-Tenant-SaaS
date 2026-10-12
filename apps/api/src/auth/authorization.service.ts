import { Injectable } from "@nestjs/common";
import type { MembershipRole } from "../generated/prisma/enums.js";
import type { Permission } from "./auth.types.js";

const rolePermissions: Record<MembershipRole, readonly Permission[]> = {
  ORGANIZATION_ADMIN: [
    "organization.read",
    "organization.update",
    "members.read",
    "members.manage",
    "invitations.manage",
    "channels.read",
    "channels.manage",
    "inbox.read",
    "messages.reply",
    "comments.reply",
    "comments.moderate",
    "assignments.self",
    "assignments.manage",
    "conversations.resolve",
    "analytics.self",
    "analytics.team",
    "audit.read",
  ],
  SUPERVISOR: [
    "organization.read",
    "members.read",
    "channels.read",
    "inbox.read",
    "messages.reply",
    "comments.reply",
    "comments.moderate",
    "assignments.self",
    "assignments.manage",
    "conversations.resolve",
    "analytics.self",
    "analytics.team",
  ],
  MODERATOR: [
    "organization.read",
    "channels.read",
    "inbox.read",
    "messages.reply",
    "comments.reply",
    "assignments.self",
    "conversations.resolve",
    "analytics.self",
  ],
};

@Injectable()
export class AuthorizationService {
  forRole(role: MembershipRole): readonly Permission[] {
    return rolePermissions[role];
  }

  hasAll(granted: readonly Permission[], required: readonly Permission[]): boolean {
    return required.every((permission) => granted.includes(permission));
  }
}
