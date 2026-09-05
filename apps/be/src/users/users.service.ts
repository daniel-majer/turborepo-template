import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../database/generated/client.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import { UpdateUserDto } from "./dto/update-user.dto.js";
import { UserDto } from "./dto/user.dto.js";

const UNIQUE_CONSTRAINT = "P2002";
const RECORD_NOT_FOUND = "P2025";

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateUserDto): Promise<UserDto> {
    try {
      const user = await this.db.user.create({ data: { email: dto.email } });
      return UserDto.from(user);
    } catch (error) {
      throw this.toHttpException(error, dto.email) ?? error;
    }
  }

  async findAll(): Promise<UserDto[]> {
    const users = await this.db.user.findMany({ orderBy: { id: "asc" } });
    return users.map((user) => UserDto.from(user));
  }

  async findOne(id: number): Promise<UserDto> {
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    return UserDto.from(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserDto> {
    try {
      const user = await this.db.user.update({ where: { id }, data: dto });
      return UserDto.from(user);
    } catch (error) {
      throw this.toHttpException(error, dto.email, id) ?? error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.db.user.delete({ where: { id } });
    } catch (error) {
      throw this.toHttpException(error, undefined, id) ?? error;
    }
  }

  /** Map known Prisma errors to HTTP responses; leave unexpected errors as 500s. */
  private toHttpException(
    error: unknown,
    email?: string,
    id?: number,
  ): HttpException | undefined {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return undefined;
    }

    if (error.code === UNIQUE_CONSTRAINT) {
      return new ConflictException(conflictMessage(error, email));
    }
    if (error.code === RECORD_NOT_FOUND) {
      return new NotFoundException(`User ${id} not found`);
    }

    return undefined;
  }
}

/** Read conflicting columns from Prisma metadata instead of assuming email. */
function conflictMessage(
  error: Prisma.PrismaClientKnownRequestError,
  email?: string,
): string {
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.join(", ") : undefined;

  if (fields === "email" && email !== undefined) {
    return `Email ${email} is already taken`;
  }

  return fields
    ? `A user with this ${fields} already exists`
    : "That user already exists";
}
