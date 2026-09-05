import { PartialType } from "@nestjs/swagger";

import { CreateUserDto } from "./create-user.dto.js";

// Swagger's PartialType preserves validation and optional API metadata.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
