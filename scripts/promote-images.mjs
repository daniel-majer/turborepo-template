import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const releaseApps = ["be", "fe", "migrate"];

export function planPromotion({
  repository,
  runId,
  runAttempt,
  digests,
  tags,
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Invalid repository");
  if (!/^\d+$/.test(runId) || !/^\d+$/.test(runAttempt))
    throw new Error("Invalid run identifier");
  const imageTag = `run-${runId}-${runAttempt}`;
  const prefix = `ghcr.io/${repository.toLowerCase()}`;
  const images = releaseApps.map((app) => {
    const digest = digests[app];
    if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? ""))
      throw new Error(`Missing or invalid ${app} digest`);
    const image = `${prefix}/${app}`;
    const aliases = tags.filter((tag) => tag.startsWith(`${image}:`));
    if (aliases.length === 0) throw new Error(`No release aliases for ${app}`);
    return {
      source: `${image}@${digest}`,
      pinnedTag: `${image}:${imageTag}`,
      aliases,
    };
  });

  const aliases = new Set(images.flatMap((image) => image.aliases));
  if (
    tags.some((tag) => !aliases.has(tag) || !/:[\w][\w.-]{0,127}$/.test(tag))
  ) {
    throw new Error("Unexpected image alias");
  }
  const suffixes = images.map((image) =>
    image.aliases.map((tag) => tag.split(":").at(-1)).toSorted(),
  );
  if (
    suffixes.some(
      (imageTags) => JSON.stringify(imageTags) !== JSON.stringify(suffixes[0]),
    )
  ) {
    throw new Error("Image aliases must match across the release");
  }
  return { imageTag, images };
}

export function promoteImages(
  plan,
  run = (args) => execFileSync("docker", args, { stdio: "inherit" }),
) {
  // Verify every source before changing tags; registry writes are not atomic across images.
  for (const image of plan.images)
    run(["buildx", "imagetools", "inspect", image.source]);
  for (const image of plan.images) {
    run([
      "buildx",
      "imagetools",
      "create",
      "--prefer-index=false",
      "--tag",
      image.pinnedTag,
      image.source,
    ]);
  }
  for (const image of plan.images) {
    run([
      "buildx",
      "imagetools",
      "create",
      "--prefer-index=false",
      ...image.aliases.flatMap((tag) => ["--tag", tag]),
      image.source,
    ]);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const plan = planPromotion({
    repository: process.env.GITHUB_REPOSITORY,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    digests: Object.fromEntries(
      releaseApps.map((app) => [
        app,
        readFileSync(`image-digests/${app}.txt`, "utf8").trim(),
      ]),
    ),
    tags: JSON.parse(process.env.IMAGE_METADATA).tags,
  });
  promoteImages(plan);
  appendFileSync(process.env.GITHUB_OUTPUT, `image-tag=${plan.imageTag}\n`);
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `Deploy this complete set with IMAGE_TAG=${plan.imageTag}.\n\n${plan.images.map((image) => `- ${image.source}`).join("\n")}\n`,
  );
}
