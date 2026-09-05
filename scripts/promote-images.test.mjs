import assert from "node:assert/strict";
import { test } from "node:test";

import {
  planPromotion,
  promoteImages,
  releaseApps,
} from "./promote-images.mjs";

function release(overrides = {}) {
  return {
    repository: "Owner/Template",
    runId: "12345",
    runAttempt: "2",
    digests: Object.fromEntries(
      releaseApps.map((app, index) => [
        app,
        `sha256:${String(index).repeat(64)}`,
      ]),
    ),
    tags: releaseApps.flatMap((app) => [
      `ghcr.io/owner/template/${app}:latest`,
      `ghcr.io/owner/template/${app}:sha-abc123`,
    ]),
    ...overrides,
  };
}

void test("all digests are required before promotion can start", () => {
  for (const missingApp of releaseApps) {
    const input = release();
    delete input.digests[missingApp];
    assert.throws(() => planPromotion(input), /Missing or invalid/);
  }
});

void test("rejects foreign, malformed or mismatched aliases", () => {
  const input = release();
  for (const tags of [
    [...input.tags, "ghcr.io/other/repo/be:latest"],
    [...input.tags, "ghcr.io/owner/template/be:invalid tag"],
    input.tags.filter((tag) => !tag.endsWith("/fe:latest")),
    input.tags.filter((tag) => !tag.includes("/migrate:")),
  ]) {
    assert.throws(() => planPromotion(release({ tags })));
  }
});

void test("checks every digest and publishes all run tags before moving any alias", () => {
  const plan = planPromotion(release());
  const commands = [];
  promoteImages(plan, (args) => commands.push(args));
  assert.equal(plan.imageTag, "run-12345-2");
  assert.equal(commands.length, 9);
  assert.ok(commands.slice(0, 3).every((args) => args[2] === "inspect"));
  assert.ok(
    commands.slice(3, 6).every((args) => args[5].endsWith(":run-12345-2")),
  );
  assert.ok(
    commands
      .slice(6)
      .every(
        (args) =>
          args.includes("--tag") && args.some((arg) => arg.endsWith(":latest")),
      ),
  );
  for (const [index, image] of plan.images.entries()) {
    assert.equal(commands[index].at(-1), image.source);
    assert.equal(commands[index + 3].at(-1), image.source);
    assert.equal(commands[index + 6].at(-1), image.source);
  }
});

void test("a missing registry digest does not modify any tag", () => {
  const commands = [];
  assert.throws(
    () =>
      promoteImages(planPromotion(release()), (args) => {
        commands.push(args);
        if (commands.length === 2) throw new Error("Registry unavailable");
      }),
    /Registry unavailable/,
  );
  assert.ok(commands.every((args) => args[2] === "inspect"));
});

void test("an incomplete run-tag publish does not move shared aliases", () => {
  const commands = [];
  assert.throws(
    () =>
      promoteImages(planPromotion(release()), (args) => {
        commands.push(args);
        if (commands.length === 5) throw new Error("Publish failed");
      }),
    /Publish failed/,
  );
  assert.ok(
    commands.every((args) => !args.some((arg) => arg.endsWith(":latest"))),
  );
});

void test("a rerun can reuse successful digests without resolving mutable candidate tags", () => {
  const first = planPromotion(release({ runAttempt: "1" }));
  const retried = planPromotion(release({ runAttempt: "3" }));
  assert.notEqual(first.imageTag, retried.imageTag);
  assert.deepEqual(
    first.images.map((image) => image.source),
    retried.images.map((image) => image.source),
  );
});

void test("an alias failure leaves a complete pinned set but still fails promotion", () => {
  const commands = [];
  assert.throws(
    () =>
      promoteImages(planPromotion(release()), (args) => {
        commands.push(args);
        if (commands.length === 8) throw new Error("Alias publish failed");
      }),
    /Alias publish failed/,
  );
  assert.ok(
    commands.slice(3, 6).every((args) => args[5].endsWith(":run-12345-2")),
  );
  assert.equal(commands.length, 8);
});

void test("a tagged release never gains latest unless metadata explicitly includes it", () => {
  const tags = releaseApps.map((app) => `ghcr.io/owner/template/${app}:1.2.3`);
  const plan = planPromotion(release({ tags }));
  assert.ok(
    plan.images.every(
      (image) =>
        image.aliases.length === 1 && image.aliases[0].endsWith(":1.2.3"),
    ),
  );
});
