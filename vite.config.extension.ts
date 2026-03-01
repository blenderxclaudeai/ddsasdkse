import { defineConfig } from "vite";
import path from "path";

// Build mode is determined by the ENTRY env var:
//   ENTRY=content  → content.js
//   ENTRY=background → background.js

const entry = process.env.ENTRY || "content";

const configs: Record<string, { entry: string; name: string; fileName: string }> = {
  content: {
    entry: path.resolve(__dirname, "src/extension/content.ts"),
    name: "VTOContent",
    fileName: "content.js",
  },
  background: {
    entry: path.resolve(__dirname, "src/extension/background.ts"),
    name: "VTOBackground",
    fileName: "background.js",
  },
};

const cfg = configs[entry];

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "dist",
    lib: {
      entry: cfg.entry,
      name: cfg.name,
      fileName: () => cfg.fileName,
      formats: ["iife"],
    },
  },
});
