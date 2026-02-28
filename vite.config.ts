import { builtinModules } from "module";
import { defineConfig } from "vite";

const enableSourceMap = process.env.VITE_SOURCEMAP === "true";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/extension.ts",
      formats: ["cjs"],
      fileName: () => "extension.js",
    },
    outDir: "dist",
    sourcemap: enableSourceMap,
    rollupOptions: {
      external: [
        "vscode", // provided at runtime by VS Code
        "ajv", // httpsnippet dynamic require
        ...builtinModules, // fs, path, os, etc.
        /^node:/, // node: protocol imports
      ],
      output: {
        // Preserve the original exports shape for the VS Code activation entrypoint
        exports: "named",
      },
    },
    // No need to minify for a VS Code extension (makes debugging easier)
    minify: false,
  },
  resolve: {
    // Prefer the Node.js condition so packages pick their CJS/Node builds
    conditions: ["node"],
  },
});
