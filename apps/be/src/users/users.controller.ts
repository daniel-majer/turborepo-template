import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { ApiDataResponse } from "../common/api-data-response.decorator.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import { UpdateUserDto } from "./dto/update-user.dto.js";
import { UserDto } from "./dto/user.dto.js";
import { UsersService } from "./users.service.js";

// Failures are not decorated anywhere: swagger.setup.ts gives every operation
// a `default` response carrying ErrorEnvelopeDto, so 400/404/409 are already
// described - and cannot be forgotten on the next route.
@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: "Create a user" })
  @ApiDataResponse(UserDto, { status: HttpStatus.CREATED })
  create(@Body() createUserDto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: "List all users, ordered by id" })
  @ApiDataResponse(UserDto, { isArray: true })
  findAll(): Promise<UserDto[]> {
    return this.usersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single user" })
  @ApiParam({ name: "id", type: "integer", example: 1 })
  @ApiDataResponse(UserDto)
  findOne(@Param("id", ParseIntPipe) id: number): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a user" })
  @ApiParam({ name: "id", type: "integer", example: 1 })
  @ApiDataResponse(UserDto)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a user" })
  @ApiParam({ name: "id", type: "integer", example: 1 })
  @ApiNoContentResponse({ description: "Deleted." })
  remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.usersService.remove(id);
  }
}
