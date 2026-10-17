import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminMutationRateLimitGuard } from "./admin-rate-limit.guard.js";
import { AdminService } from "./admin.service.js";
import { OrganizationAdminController } from "./organization-admin.controller.js";
import { PlatformAdminController } from "./platform-admin.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [PlatformAdminController, OrganizationAdminController],
  providers: [AdminService, AdminMutationRateLimitGuard],
})
export class AdminModule {}
