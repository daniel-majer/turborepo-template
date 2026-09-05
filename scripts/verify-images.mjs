import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Verify production Compose using disposable resources, isolated from dev and API tests.
const root = fileURLToPath(new URL("../", import.meta.url));
const project = `template-verify-${randomBytes(6).toString("hex")}`;
const abort = new AbortController();
const reservations = [];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let cleaning = false;
let stackCreated = false;
const builtImages = [];
let environment;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () =>
    abort.abort(new Error(`Interrupted by ${signal}`)),
  );
}

function run(command, args, { capture = false, env = environment } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      signal: cleaning ? undefined : abort.signal,
      stdio: ["ignore", capture ? "pipe" : "inherit", "inherit"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve(output.trim());
      else
        reject(
          new Error(`${command} ${args.join(" ")} failed (${signal ?? code})`),
        );
    });
  });
}

function compose(args, options) {
  return run(
    "docker",
    [
      "compose",
      "--project-name",
      project,
      "--env-file",
      ".env.production.example",
      "--file",
      "docker-compose.prod.yml",
      ...args,
    ],
    options,
  );
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  reservations.push(server);
  return server.address().port;
}

async function releasePorts() {
  await Promise.all(
    reservations.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
}

async function request(url, status = 200, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]),
  });
  assert.equal(response.status, status, `${options.method ?? "GET"} ${url}`);
  return response;
}

async function eventually(check) {
  const deadline = Date.now() + 60_000;
  while (true) {
    try {
      // Poll readiness until the process is available.
      // oxlint-disable-next-line no-await-in-loop
      await check();
      return;
    } catch (error) {
      if (abort.signal.aborted || Date.now() >= deadline) throw error;
      // oxlint-disable-next-line no-await-in-loop
      await setTimeout(300, undefined, { signal: abort.signal });
    }
  }
}

async function main() {
  const [apiPort, webPort] = await Promise.all([reservePort(), reservePort()]);
  const apiOrigin = `http://127.0.0.1:${apiPort}`;
  const api = `${apiOrigin}/api`;
  const web = `http://127.0.0.1:${webPort}`;
  environment = {
    ...process.env,
    IMAGE_REPO: project,
    IMAGE_TAG: "latest",
    POSTGRES_USER: "postgres",
    POSTGRES_DB: "image_test",
    POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
    APP_DB_USER: "app",
    APP_DB_PASSWORD: randomBytes(24).toString("hex"),
    REDIS_PASSWORD: randomBytes(24).toString("hex"),
    CACHE_NAMESPACE: project,
    CORS_ORIGINS: web,
    LOG_LEVEL: "info",
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
  };

  const images = [
    { app: "be", file: "apps/be/Dockerfile", target: "runtime" },
    { app: "migrate", file: "apps/be/Dockerfile", target: "migrate" },
    { app: "fe", file: "apps/fe/Dockerfile", target: "runtime" },
  ];

  console.log(`Building production images (${project})`);
  for (const { app, file, target } of images) {
    const image = `${project}/${app}:latest`;
    // Build sequentially to limit peak memory.
    // oxlint-disable-next-line no-await-in-loop
    await run("docker", [
      "build",
      "--file",
      file,
      "--target",
      target,
      "--tag",
      image,
      ...(app === "fe"
        ? [
            "--build-arg",
            `NEXT_PUBLIC_APP_URL=${web}`,
            "--build-arg",
            `NEXT_PUBLIC_API_URL=${apiOrigin}`,
          ]
        : []),
      ".",
    ]);
    builtImages.push(image);
  }

  const runtimePackages = await run(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--entrypoint",
      "node",
      `${project}/be:latest`,
      "-e",
      [
        "const {existsSync,readdirSync}=require('node:fs')",
        "const names=readdirSync('/app/node_modules/.bun')",
        "const forbidden=['prisma@','mysql2@','lodash@','deepmerge-ts@','valibot@']",
        "const found=forbidden.filter((prefix)=>names.some((name)=>name.startsWith(prefix)))",
        "if(existsSync('/app/apps/be/node_modules/.bin/prisma')||found.length)throw new Error(`CLI packages leaked into runtime: ${found.join(', ')}`)",
        "process.stdout.write('clean')",
      ].join(";"),
    ],
    { capture: true },
  );
  assert.equal(runtimePackages, "clean");
  const migrateCli = await run(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--entrypoint",
      "node",
      `${project}/migrate:latest`,
      "-e",
      "const {existsSync}=require('node:fs');if(!existsSync('/app/apps/be/node_modules/.bin/prisma'))process.exit(1);process.stdout.write('present')",
    ],
    { capture: true },
  );
  assert.equal(migrateCli, "present");
  console.log("PASS: migration tooling is isolated from the API runtime");

  await releasePorts();
  stackCreated = true;
  await compose(["up", "--detach", "--wait", "--wait-timeout", "120"]);

  for (const service of ["api", "web"]) {
    // oxlint-disable-next-line no-await-in-loop
    const uid = await compose(
      ["exec", "-T", service, "node", "-e", "console.log(process.getuid())"],
      { capture: true },
    );
    assert.ok(Number(uid) > 0, `${service} must run as a non-root user`);
  }
  assert.deepEqual(await (await request(`${api}/health/live`)).json(), {
    data: { status: "ok" },
  });
  assert.deepEqual(await (await request(`${api}/health/ready`)).json(), {
    data: { status: "ok", checks: { database: "up", cache: "up" } },
  });

  const notFound = await request(`${api}/missing`, 404);
  assert.equal(notFound.headers.get("x-content-type-options"), "nosniff");
  const error = await notFound.json();
  assert.equal(error.data, null);
  assert.equal(error.error.statusCode, 404);
  assert.equal(error.error.path, "/api/missing");
  assert.match(error.error.requestId, uuid);
  assert.equal(notFound.headers.get("x-request-id"), error.error.requestId);
  await request(`${api}/docs-json`, 404);

  const preflight = await request(`${api}/users/1`, 204, {
    method: "OPTIONS",
    headers: { Origin: web, "Access-Control-Request-Method": "DELETE" },
  });
  assert.equal(preflight.headers.get("access-control-allow-origin"), web);
  assert.equal(
    preflight.headers.get("access-control-allow-credentials"),
    "true",
  );
  assert.ok(
    preflight.headers
      .get("access-control-allow-methods")
      ?.split(/,\s*/)
      .includes("DELETE"),
  );
  const rejectedOrigin = await request(`${api}/health/live`, 200, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(rejectedOrigin.headers.get("access-control-allow-origin"), null);

  const invalid = await request(`${api}/users`, 400, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid" }),
  });
  assert.ok(Array.isArray((await invalid.json()).error.details));

  const emails = [0, 1].map(
    (index) => `image-${index}-${randomBytes(6).toString("hex")}@example.com`,
  );
  const users = [];
  for (const email of emails) {
    // oxlint-disable-next-line no-await-in-loop
    const created = await request(`${api}/users`, 201, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // oxlint-disable-next-line no-await-in-loop
    const user = (await created.json()).data;
    assert.ok(Number.isInteger(user.id));
    assert.equal(user.email, email);
    users.push(user);
  }
  const firstPage = await (await request(`${api}/users?take=1`)).json();
  assert.equal(firstPage.data.length, 1);
  assert.equal(firstPage.meta.hasNextPage, true);
  assert.equal(firstPage.meta.nextCursor, firstPage.data[0].id);
  const secondPage = await (
    await request(`${api}/users?take=1&cursor=${firstPage.meta.nextCursor}`)
  ).json();
  assert.equal(secondPage.data.length, 1);
  assert.notEqual(secondPage.data[0].id, firstPage.data[0].id);
  assert.deepEqual(secondPage.meta, {
    nextCursor: null,
    hasNextPage: false,
  });
  const html = await (await request(`${web}/users`)).text();
  for (const { email, id } of users) {
    assert.ok(
      html.includes(email),
      "SSR must contain database rows, not just a page heading",
    );
    // oxlint-disable-next-line no-await-in-loop
    const deleted = await request(`${api}/users/${id}`, 204, {
      method: "DELETE",
    });
    // oxlint-disable-next-line no-await-in-loop
    assert.equal(await deleted.text(), "");
    // oxlint-disable-next-line no-await-in-loop
    await request(`${api}/users/${id}`, 404);
  }
  console.log(
    "PASS: migrations, non-root apps, health, request IDs, pagination, CRUD and SSR",
  );

  await compose(["stop", "api", "redis"]);
  await compose(["rm", "--force", "api"]);
  // Use Compose startup so a Redis dependency regression cannot hide here.
  await compose(["up", "--detach", "api"]);
  await eventually(async () => {
    assert.deepEqual(await (await request(`${api}/health/ready`)).json(), {
      data: { status: "degraded", checks: { database: "up", cache: "down" } },
    });
  });
  assert.deepEqual(await (await request(api)).json(), {
    data: "Hello World!",
  });
  console.log(
    "PASS: API boots without Redis and cached routes still return successful data",
  );

  await compose(["stop", "postgres"]);
  await request(`${api}/health/live`);
  const unavailable = await request(`${api}/health/ready`, 503);
  assert.equal((await unavailable.json()).error.statusCode, 503);
  console.log("PASS: database outage fails readiness, not liveness");

  const logs = await compose(["logs", "--no-color", "--no-log-prefix", "api"], {
    capture: true,
  });
  assert.ok(
    logs.split("\n").some((line) => {
      try {
        return typeof JSON.parse(line).level === "number";
      } catch {
        return false;
      }
    }),
    "API must emit structured JSON logs",
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  cleaning = true;
  if (stackCreated && process.exitCode) {
    await compose(["logs", "--no-color", "--tail", "100"]).catch(console.error);
  }
  try {
    await releasePorts();
    if (stackCreated) {
      await compose([
        "down",
        "--volumes",
        "--remove-orphans",
        "--timeout",
        "10",
      ]);
    }
  } catch (error) {
    console.error(`Cleanup failed for ${project}:`, error);
    process.exitCode = 1;
  }
  // Remove only this run's image tags.
  await Promise.all(
    builtImages.map((image) =>
      run("docker", ["image", "rm", image]).catch((error) => {
        console.error(error);
        process.exitCode = 1;
      }),
    ),
  );
}

if (!process.exitCode)
  console.log(
    "All production-image checks passed; disposable resources removed.",
  );
