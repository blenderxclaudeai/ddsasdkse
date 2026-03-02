import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

export default defineConfig(() => {
  const extensionRoot = __dirname;
  const distDir = path.resolve(extensionRoot, "dist");

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
            envDir: path.resolve(extensionRoot, ".."),
            build: {
              outDir: distDir,
              emptyOutDir: false,
              target: "chrome110",
              lib: {
                entry: path.resolve(extensionRoot, "src/content/index.ts"),
                formats: ["iife"],
                name: "VTOContent",
                fileName: () => "content.js",
              },
              rollupOptions: {
                output: { inlineDynamicImports: true },
              },
            },
            resolve: {
              alias: { "@ext": path.resolve(extensionRoot, "src") },
            },
          });

          // Build background service worker (IIFE)
          await build({
            configFile: false,
            envDir: path.resolve(extensionRoot, ".."),
            build: {
              outDir: distDir,
              emptyOutDir: false,
              target: "chrome110",
              lib: {
                entry: path.resolve(extensionRoot, "src/background/index.ts"),
                formats: ["iife"],
                name: "VTOBackground",
                fileName: () => "background.js",
              },
              rollupOptions: {
                output: { inlineDynamicImports: true },
              },
            },
            resolve: {
              alias: { "@ext": path.resolve(extensionRoot, "src") },
            },
          });

          // Copy manifest.json into dist
          fs.copyFileSync(
            path.resolve(extensionRoot, "manifest.json"),
            path.resolve(distDir, "manifest.json")
          );

          // Rename index.html → popup.html to match manifest
          const indexHtml = path.resolve(distDir, "index.html");
          const popupHtml = path.resolve(distDir, "popup.html");
          if (fs.existsSync(indexHtml)) {
            fs.renameSync(indexHtml, popupHtml);
          }
        },
      },
    ],

    // Popup is the main entry (React app) — root must be src/popup
    // so that index.html lands at dist root (not dist/src/popup/)
    root: path.resolve(extensionRoot, "src/popup"),
    base: "./",
    envDir: path.resolve(extensionRoot, ".."),

    build: {
      outDir: distDir,
      emptyOutDir: true,
      modulePreload: { polyfill: false },
      target: "chrome110",
      rollupOptions: {
        input: path.resolve(extensionRoot, "src/popup/index.html"),
        output: {
          entryFileNames: "assets/popup-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },

    resolve: {
      alias: { "@ext": path.resolve(extensionRoot, "src") },
    },
  };
});
