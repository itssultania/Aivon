const { build } = require("esbuild");

const baseConfig = {
  bundle: true,
  minify: process.env.NODE_ENV === "production", // Minify only in production
  sourcemap: process.env.NODE_ENV !== "production", // Create sourcemaps only for development
};

// Configuration for the extension's backend code (runs in Node.js)
const extensionConfig = {
  ...baseConfig,
  platform: "node",
  mainFields: ["module", "main"], // Important for Node.js environment
  format: "cjs", // CommonJS format suitable for VS Code extensions
  entryPoints: ["./src/extension.ts"], // Entry point for the extension host code
  outfile: "./dist/extension.js", // Output bundled file to 'dist' folder
  external: ["vscode"], // Exclude 'vscode' module, as it's provided by VS Code runtime
};

// Configuration for the webview's frontend code (runs in browser context)
const webviewConfig = {
  ...baseConfig,
  platform: "browser", // Target browser environment
  format: "iife", // Immediately Invoked Function Expression format suitable for <script> tags
  entryPoints: ["./media/main.js"], // Entry point for the webview code
  outfile: "./dist/webview.js", // Output bundled file to 'dist' folder
};

(async () => {
  try {
    // Build both configurations concurrently
    await Promise.all([
        build(extensionConfig),
        build(webviewConfig)
    ]);
    console.log("Build complete!");
  } catch (err) {
    process.stderr.write(err.stderr);
    process.exit(1);
  }
})(); 