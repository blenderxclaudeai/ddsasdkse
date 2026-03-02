import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

export default defineConfig(() => {
  const distDir = path.resolve(__dirname, "dist");

  return {
    plugins: [
      react(),
      {
        name: "extension-post-build",
        async closeBundle() {
          const { build } = await import("vite");

          // Build content script (IIFE)
          await build({
            configFile: false,
            envDir: path.resolve(__dirname, ".."),
            build: {
              outDir: distDir,
              emptyOutDir: false,
              target: "chrome110",
              lib: {
                entry: path.resolve(__dirname, "src/content/index.ts"),
                formats: ["iife"],
                name: "VTOContent",
                fileName: () => "content.js",
              },
              rollupOptions: {
                output: { inlineDynamicImports: true },
              },
            },
            resolve: {
              alias: { "@ext": path.resolve(__dirname, "src") },
            },
          });

          // Build background service worker (IIFE)
          await build({
            configFile: false,
            envDir: path.resolve(__dirname, ".."),
            build: {
              outDir: distDir,
              emptyOutDir: false,
              target: "chrome110",
              lib: {
                entry: path.resolve(__dirname, "src/background/index.ts"),
                formats: ["iife"],
                name: "VTOBackground",
                fileName: () => "background.js",
              },
              rollupOptions: {
                output: { inlineDynamicImports: true },
              },
            },
            resolve: {
              alias: { "@ext": path.resolve(__dirname, "src") },
            },
          });

          // Copy manifest.json into dist
          fs.copyFileSync(
            path.resolve(__dirname, "manifest.json"),
            path.resolve(distDir, "manifest.json")
          );
        },
      },
    ],

    // Popup is the main entry (React app)
    root: path.resolve(__dirname, "src/popup"),
    base: "./",
    envDir: path.resolve(__dirname, ".."),

    build: {
      outDir: distDir,
      emptyOutDir: true,
      modulePreload: { polyfill: false },
      target: "chrome110",
      rollupOptions: {
        input: path.resolve(__dirname, "src/popup/index.html"),
        output: {
          entryFileNames: "assets/popup-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },

    resolve: {
      alias: { "@ext": path.resolve(__dirname, "src") },
    },
  };
});
