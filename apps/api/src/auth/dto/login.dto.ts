import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "moderator@example.test" })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
