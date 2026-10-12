import { Injectable } from "@nestjs/common";
import { hash, verify, argon2id } from "argon2";

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  async verify(hashValue: string, password: string): Promise<boolean> {
    try {
      return await verify(hashValue, password);
    } catch {
      return false;
    }
  }
}
