import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

const target = process.env.BUILD_TARGET || "popup";

export default defineConfig(() => {
  const distDir = path.resolve(__dirname, "dist");

  if (target === "popup") {
    return {
      root: path.resolve(__dirname, "src/popup"),
      base: "./",
      envDir: path.resolve(__dirname, ".."),
      plugins: [
        react(),
        {
          name: "copy-manifest",
          closeBundle() {
            fs.mkdirSync(distDir, { recursive: true });
            fs.copyFileSync(
              path.resolve(__dirname, "manifest.json"),
              path.resolve(distDir, "manifest.json")
            );
          },
        },
      ],
      build: {
        outDir: distDir,
        emptyOutDir: true,
        modulePreload: { polyfill: false },
        target: "chrome110",
      },
      resolve: {
        alias: { "@ext": path.resolve(__dirname, "src") },
      },
    };
  }

  // Content script or background service worker
  return {
    envDir: path.resolve(__dirname, ".."),
    build: {
      outDir: distDir,
      emptyOutDir: false,
      target: "chrome110",
      lib: {
        entry: path.resolve(__dirname, `src/${target}.ts`),
        formats: ["iife"],
        name: target === "content" ? "VTOContent" : "VTOBackground",
        fileName: () => `${target}.js`,
      },
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
    resolve: {
      alias: { "@ext": path.resolve(__dirname, "src") },
    },
  };
});
