import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppService } from "./app.service.js";
import { ApiDataResponse } from "./common/api-data-response.decorator.js";

@ApiTags("app")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "Hello world, served from the cache" })
  @ApiDataResponse({ type: "string" })
  getHello(): Promise<string> {
    return this.appService.getHello();
  }
}
