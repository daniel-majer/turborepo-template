import { useTestApp } from "./setup.js";

describe("UsersController (e2e)", () => {
  const t = useTestApp();

  const create = (email: unknown) =>
    t.app.inject({ method: "POST", url: "/api/users", payload: { email } });

  describe("POST /users", () => {
    it("creates a user", async () => {
      const res = await create("ada@example.com");

      expect(res.statusCode).toBe(201);
      expect(res.json().data).toMatchObject({
        id: expect.any(Number),
        email: "ada@example.com",
      });
      await expect(t.db.user.count()).resolves.toBe(1);
    });

    it("normalizes the email before storing it", async () => {
      const res = await create("  Ada@Example.COM ");

      expect(res.json().data.email).toBe("ada@example.com");
    });

    it("rejects an invalid email", async () => {
      const res = await create("not-an-email");

      expect(res.statusCode).toBe(400);
      await expect(t.db.user.count()).resolves.toBe(0);
    });

    it("rejects unknown properties", async () => {
      const res = await t.app.inject({
        method: "POST",
        url: "/api/users",
        payload: { email: "ada@example.com", isAdmin: true },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects a duplicate email with 409", async () => {
      await create("ada@example.com");
      const res = await create("ada@example.com");

      expect(res.statusCode).toBe(409);
      await expect(t.db.user.count()).resolves.toBe(1);
    });
  });

  describe("GET /users", () => {
    it("returns an empty list", async () => {
      const res = await t.app.inject({ method: "GET", url: "/api/users" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        data: [],
        meta: { nextCursor: null, hasNextPage: false },
      });
    });

    it("returns a page ordered by id", async () => {
      await create("ada@example.com");
      await create("grace@example.com");

      const res = await t.app.inject({ method: "GET", url: "/api/users" });

      expect(res.json().data.map((u: { email: string }) => u.email)).toEqual([
        "ada@example.com",
        "grace@example.com",
      ]);
    });

    it("defaults to 20 rows and follows cursors without overlaps", async () => {
      await t.db.user.createMany({
        data: Array.from({ length: 23 }, (_, index) => ({
          email: `user-${index}@example.com`,
        })),
      });
      const first = (
        await t.app.inject({ method: "GET", url: "/api/users" })
      ).json();
      expect(first.data).toHaveLength(20);
      expect(first.meta).toEqual({
        nextCursor: first.data[19].id,
        hasNextPage: true,
      });

      const second = (
        await t.app.inject({
          method: "GET",
          url: `/api/users?cursor=${first.meta.nextCursor}`,
        })
      ).json();
      expect(second.data).toHaveLength(3);
      expect(second.data[0].id).toBeGreaterThan(first.meta.nextCursor);
      expect(second.meta).toEqual({ nextCursor: null, hasNextPage: false });
    });

    it("continues when the row used as a cursor was deleted", async () => {
      const firstId = (await create("ada@example.com")).json().data.id;
      const secondId = (await create("grace@example.com")).json().data.id;
      await t.db.user.delete({ where: { id: firstId } });

      const res = await t.app.inject({
        method: "GET",
        url: `/api/users?take=1&cursor=${firstId}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.map((user: { id: number }) => user.id)).toEqual([
        secondId,
      ]);
      expect(res.json().meta).toEqual({ nextCursor: null, hasNextPage: false });
    });

    it("accepts the maximum page size", async () => {
      const res = await t.app.inject({
        method: "GET",
        url: "/api/users?take=100",
      });
      expect(res.statusCode).toBe(200);
    });

    it.each([
      "take=0",
      "take=-1",
      "take=101",
      "take=1.5",
      "take=nope",
      "take=",
      "cursor=0",
      "cursor=-1",
      "cursor=1.5",
      "cursor=nope",
      "cursor=9007199254740992",
      "cursor=2147483648",
      "cursor=",
      "extra=1",
    ])("rejects invalid pagination: %s", async (query) => {
      const res = await t.app.inject({
        method: "GET",
        url: `/api/users?${query}`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toBe("Validation failed");
    });
  });

  describe("GET /users/:id", () => {
    it("returns the user", async () => {
      const { id } = (await create("ada@example.com")).json().data;

      const res = await t.app.inject({
        method: "GET",
        url: `/api/users/${id}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.email).toBe("ada@example.com");
    });

    it("404s for an unknown id", async () => {
      const res = await t.app.inject({ method: "GET", url: "/api/users/999" });

      expect(res.statusCode).toBe(404);
    });

    it("400s for a non-numeric id", async () => {
      const res = await t.app.inject({ method: "GET", url: "/api/users/abc" });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /users/:id", () => {
    it("updates the email", async () => {
      const { id } = (await create("ada@example.com")).json().data;

      const res = await t.app.inject({
        method: "PATCH",
        url: `/api/users/${id}`,
        payload: { email: "grace@example.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.email).toBe("grace@example.com");
    });

    it("404s for an unknown id", async () => {
      const res = await t.app.inject({
        method: "PATCH",
        url: "/api/users/999",
        payload: { email: "grace@example.com" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("409s when the email is taken", async () => {
      await create("ada@example.com");
      const { id } = (await create("grace@example.com")).json().data;

      const res = await t.app.inject({
        method: "PATCH",
        url: `/api/users/${id}`,
        payload: { email: "ada@example.com" },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe("DELETE /users/:id", () => {
    it("deletes the user and returns 204", async () => {
      const { id } = (await create("ada@example.com")).json().data;

      const res = await t.app.inject({
        method: "DELETE",
        url: `/api/users/${id}`,
      });

      expect(res.statusCode).toBe(204);
      await expect(t.db.user.count()).resolves.toBe(0);
    });

    it("404s for an unknown id", async () => {
      const res = await t.app.inject({
        method: "DELETE",
        url: "/api/users/999",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
