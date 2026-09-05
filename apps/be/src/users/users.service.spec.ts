import { createMock, DeepMocked } from "@golevelup/ts-vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../database/generated/client.js";
import { UsersQueryDto } from "./dto/users-query.dto.js";
import { UsersService } from "./users.service.js";

const ada = {
  id: 1,
  email: "ada@example.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("boom", {
    code,
    clientVersion: "7.0.0",
  });
}

describe("UsersService", () => {
  let service: UsersService;
  let db: DeepMocked<DatabaseService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService],
    })
      .useMocker(() => createMock())
      .compile();

    service = moduleRef.get(UsersService);
    db = moduleRef.get(DatabaseService);
  });

  describe("create", () => {
    it("persists the user and returns the public shape", async () => {
      db.user.create.mockResolvedValue(ada);

      await expect(service.create({ email: ada.email })).resolves.toEqual(ada);
      expect(db.user.create.mock.calls).toEqual([
        [{ data: { email: ada.email } }],
      ]);
    });

    it("turns a duplicate email into a 409", async () => {
      db.user.create.mockRejectedValue(prismaError("P2002"));

      await expect(service.create({ email: ada.email })).rejects.toThrow(
        ConflictException,
      );
    });

    it("rethrows errors it does not understand", async () => {
      db.user.create.mockRejectedValue(new Error("connection lost"));

      await expect(service.create({ email: ada.email })).rejects.toThrow(
        "connection lost",
      );
    });
  });

  describe("findAll", () => {
    it("returns users in a stable order", async () => {
      db.user.findMany.mockResolvedValue([ada]);

      await expect(service.findAll(new UsersQueryDto())).resolves.toMatchObject(
        {
          data: [ada],
          meta: { nextCursor: null, hasNextPage: false },
        },
      );
      expect(db.user.findMany.mock.calls).toEqual([
        [{ orderBy: { id: "asc" }, take: 21 }],
      ]);
    });

    it("uses one lookahead row and excludes it from the page", async () => {
      db.user.findMany.mockResolvedValue([ada, { ...ada, id: 2 }]);

      await expect(service.findAll({ take: 1 })).resolves.toMatchObject({
        data: [ada],
        meta: { nextCursor: 1, hasNextPage: true },
      });
      expect(db.user.findMany.mock.calls).toEqual([
        [{ orderBy: { id: "asc" }, take: 2 }],
      ]);
    });

    it("continues after an id without requiring the cursor row to exist", async () => {
      db.user.findMany.mockResolvedValue([{ ...ada, id: 4 }]);

      await expect(
        service.findAll({ take: 20, cursor: 3 }),
      ).resolves.toMatchObject({
        data: [{ ...ada, id: 4 }],
        meta: { nextCursor: null, hasNextPage: false },
      });
      expect(db.user.findMany.mock.calls).toEqual([
        [
          {
            where: { id: { gt: 3 } },
            orderBy: { id: "asc" },
            take: 21,
          },
        ],
      ]);
    });
  });

  describe("findOne", () => {
    it("returns the user", async () => {
      db.user.findUnique.mockResolvedValue(ada);

      await expect(service.findOne(1)).resolves.toEqual(ada);
    });

    it("throws a 404 when the user is missing", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("applies the patch", async () => {
      db.user.update.mockResolvedValue({ ...ada, email: "grace@example.com" });

      await expect(
        service.update(1, { email: "grace@example.com" }),
      ).resolves.toMatchObject({ email: "grace@example.com" });
      expect(db.user.update.mock.calls).toEqual([
        [{ where: { id: 1 }, data: { email: "grace@example.com" } }],
      ]);
    });

    it("turns a missing record into a 404", async () => {
      db.user.update.mockRejectedValue(prismaError("P2025"));

      await expect(service.update(99, { email: ada.email })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("turns a duplicate email into a 409", async () => {
      db.user.update.mockRejectedValue(prismaError("P2002"));

      await expect(service.update(1, { email: ada.email })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("remove", () => {
    it("deletes the user", async () => {
      db.user.delete.mockResolvedValue(ada);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(db.user.delete.mock.calls).toEqual([[{ where: { id: 1 } }]]);
    });

    it("throws a 404 when the user is missing", async () => {
      db.user.delete.mockRejectedValue(prismaError("P2025"));

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});
