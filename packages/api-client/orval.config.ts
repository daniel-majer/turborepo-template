import { defineConfig } from "orval";

/**
 * Reads the committed spec from apps/be and writes a typed client into
 * src/generated, which is gitignored the same way the Prisma client is:
 * generated code is an artefact of the contract, and reviewing it twice - once
 * as the spec diff, once as the output - is reviewing nothing.
 *
 *   bun run api:sync   (from the repo root: regenerates the spec, then this)
 */
export default defineConfig({
  api: {
    input: {
      target: "../../apps/be/openapi.json",
    },
    output: {
      // split: the hooks in one file, the models in their own directory, so
      // the package has a single stable entry point to re-export.
      mode: "split",
      target: "./src/generated/api.ts",
      schemas: "./src/generated/model",
      client: "react-query",
      override: {
        // Every generated call goes through src/fetcher.ts: one place for the
        // base url, credentials, and turning the error envelope into a throw.
        mutator: {
          path: "./src/fetcher.ts",
          name: "fetcher",
        },
        fetch: {
          // Without this every call returns { data, status, headers } and the
          // payload sits two levels down, at res.data.data - the envelope is
          // one level of nesting already, and two is where call sites start
          // unwrapping by trial and error. fetcher() throws on a non-2xx
          // instead, so the status is not lost.
          includeHttpResponseReturnType: false,
        },
        query: {
          // The suspense variant of each hook, as `use<Operation>Suspense`.
          useSuspenseQuery: true,
          // `prefetch<Operation>Query`: the server half of the suspense story.
          // A server component prefetches into a QueryClient, hands it through
          // HydrationBoundary, and the client hook reads a warm cache instead
          // of suspending on a request of its own.
          usePrefetch: true,
        },
      },
      // Preserves the zod entry's output below, which writes into the same
      // directory. Without the negation whichever config ran second would
      // delete the other's files.
      clean: ["!**/schemas.ts"],
      // Deliberately no `formatter`: this directory is excluded from oxfmt and
      // oxlint the way the Prisma client is, so running a formatter over it
      // would only produce churn nobody reads on every regeneration.
    },
  },

  // The same spec again, as runtime schemas. The types above vanish at compile
  // time, so nothing checks what a user typed into a form - and retyping the
  // backend's rules in the form is how the two drift. What the DTOs declare
  // through @ApiProperty (format: email, maxLength) is what lands here.
  zod: {
    input: {
      target: "../../apps/be/openapi.json",
      // `generate.response` below only governs the per-operation schemas; every
      // components.schemas entry is emitted regardless, which for this spec
      // would fill the file with response DTOs - the opposite of what it is
      // for. Request bodies are unaffected: orval names those after the
      // operation and inlines the component they reference, so a body that is
      // a $ref still generates as `usersCreateBody`.
      filters: { mode: "exclude", schemas: [/.*/] },
    },
    output: {
      // One file beside api.ts rather than a second split tree: these are
      // schemas, and the package re-exports them from one entry point anyway.
      target: "./src/generated/schemas.ts",
      client: "zod",
      override: {
        zod: {
          // zod 4, which is what every workspace depends on.
          version: 4,
          // Only what the client sends. The response direction is covered by
          // the compile-time types generated above.
          generate: {
            body: true,
            param: true,
            query: true,
            header: false,
            response: false,
          },
        },
      },
    },
  },
});
