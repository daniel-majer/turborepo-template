import { Module } from "@nestjs/common";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { CoreModule } from "./core/core.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [CoreModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
