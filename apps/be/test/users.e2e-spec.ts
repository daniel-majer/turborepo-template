import { useTestApp } from "./setup.js";

describe("UsersController (e2e)", () => {
  const t = useTestApp();

  const create = (email: unknown) =>
    t.app.inject({ method: "POST", url: "/users", payload: { email } });

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
        url: "/users",
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
      const res = await t.app.inject({ method: "GET", url: "/users" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: [] });
    });

    it("returns every user ordered by id", async () => {
      await create("ada@example.com");
      await create("grace@example.com");

      const res = await t.app.inject({ method: "GET", url: "/users" });

      expect(res.json().data.map((u: { email: string }) => u.email)).toEqual([
        "ada@example.com",
        "grace@example.com",
      ]);
    });
  });

  describe("GET /users/:id", () => {
    it("returns the user", async () => {
      const { id } = (await create("ada@example.com")).json().data;

      const res = await t.app.inject({ method: "GET", url: `/users/${id}` });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.email).toBe("ada@example.com");
    });

    it("404s for an unknown id", async () => {
      const res = await t.app.inject({ method: "GET", url: "/users/999" });

      expect(res.statusCode).toBe(404);
    });

    it("400s for a non-numeric id", async () => {
      const res = await t.app.inject({ method: "GET", url: "/users/abc" });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /users/:id", () => {
    it("updates the email", async () => {
      const { id } = (await create("ada@example.com")).json().data;

      const res = await t.app.inject({
        method: "PATCH",
        url: `/users/${id}`,
        payload: { email: "grace@example.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.email).toBe("grace@example.com");
    });

    it("404s for an unknown id", async () => {
      const res = await t.app.inject({
        method: "PATCH",
        url: "/users/999",
        payload: { email: "grace@example.com" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("409s when the email is taken", async () => {
      await create("ada@example.com");
      const { id } = (await create("grace@example.com")).json().data;

      const res = await t.app.inject({
        method: "PATCH",
        url: `/users/${id}`,
        payload: { email: "ada@example.com" },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe("DELETE /users/:id", () => {
    it("deletes the user and returns 204", async () => {
      const { id } = (await create("ada@example.com")).json().data;

      const res = await t.app.inject({ method: "DELETE", url: `/users/${id}` });

      expect(res.statusCode).toBe(204);
      await expect(t.db.user.count()).resolves.toBe(0);
    });

    it("404s for an unknown id", async () => {
      const res = await t.app.inject({ method: "DELETE", url: "/users/999" });

      expect(res.statusCode).toBe(404);
    });
  });
});
