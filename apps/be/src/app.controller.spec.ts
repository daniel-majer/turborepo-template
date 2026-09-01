import { createMock, DeepMocked } from "@golevelup/ts-vitest";
import { Test, TestingModule } from "@nestjs/testing";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

describe("AppController", () => {
  let appController: AppController;
  let appService: DeepMocked<AppService>;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    })
      .useMocker(() => createMock())
      .compile();

    appController = app.get(AppController);
    appService = app.get(AppService);
  });

  describe("root", () => {
    it('should return "Hello World!"', () => {
      appService.getHello.mockReturnValue("Hello World!");

      expect(appController.getHello()).toBe("Hello World!");
      expect(appService.getHello.mock.calls).toHaveLength(1);
    });
  });
});
