import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  InvitationStatus,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  PlatformRole,
  UserStatus,
} from "../generated/prisma/enums.js";

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class OrganizationListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}

export class UserListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(PlatformRole)
  platformRole?: PlatformRole;
}

export class AuditListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}

export class UpdateOrganizationStatusDto {
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class MemberListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}

export class TeamListQueryDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TeamMemberDto {
  @IsUUID()
  membershipId!: string;
}

export class InvitationListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;
}

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays = 7;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token!: string;
}

export class RegisterInvitationDto extends AcceptInvitationDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName!: string;

  @IsStrongPassword({
    minLength: 12,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @MaxLength(128)
  password!: string;
}
