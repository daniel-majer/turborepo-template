import { PartialType } from "@nestjs/swagger";

import { CreateUserDto } from "./create-user.dto.js";

// @nestjs/swagger's PartialType, not @nestjs/mapped-types': it keeps the
// validation rules AND carries the ApiProperty metadata over as optional.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
