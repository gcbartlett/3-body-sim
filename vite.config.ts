import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const VERSION_TIMEZONE = "America/Los_Angeles";

const gitValue = (command: string) => {
  try {
    return execSync(command, {
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, TZ: VERSION_TIMEZONE },
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
};

const commitDate = gitValue("git show -s --format=%cd --date=format:%Y.%m.%d HEAD");
const shortSha = gitValue("git rev-parse --short=7 HEAD");
const appVersion = commitDate && shortSha ? `${commitDate}+g${shortSha}` : "dev";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
});
