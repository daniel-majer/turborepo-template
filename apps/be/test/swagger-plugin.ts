import { fileURLToPath } from "node:url";

import { before } from "@nestjs/swagger/plugin";
import ts from "typescript";
import type { Plugin } from "vitest/config";

import nestConfig from "../nest-cli.json" with { type: "json" };

/** Apply Nest's DTO transformer before Vite, using nest-cli.json options. */
export function swaggerPlugin(): Plugin {
  const options = nestConfig.compilerOptions.plugins.find(
    (plugin) => plugin.name === "@nestjs/swagger",
  )?.options;
  if (!options) throw new Error("Missing @nestjs/swagger compiler plugin");

  const configPath = fileURLToPath(
    new URL("../tsconfig.json", import.meta.url),
  );
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      },
    },
  );
  if (!config || config.errors.length) {
    throw new Error("Cannot load backend tsconfig for the Swagger transformer");
  }

  const printer = ts.createPrinter();
  let program: ts.Program | undefined;

  return {
    name: "nestjs-swagger-dtos",
    enforce: "pre",
    watchChange() {
      program = undefined;
    },
    transform(_code, id) {
      if (id.includes("/node_modules/") || !/\.(dto|entity)\.ts$/.test(id))
        return null;

      program ??= ts.createProgram(config.fileNames, config.options);
      const source = program.getSourceFile(id);
      if (!source) throw new Error(`DTO is not included in tsconfig: ${id}`);

      const result = ts.transform(source, [before(options, program)]);
      try {
        const transformed = result.transformed[0];
        if (!transformed) throw new Error(`Swagger did not transform ${id}`);
        return { code: printer.printFile(transformed), map: null };
      } finally {
        result.dispose();
      }
    },
  };
}
