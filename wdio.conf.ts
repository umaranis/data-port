import { spawn, spawnSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";
import type { Options } from "@wdio/types";

let tauriDriver: ReturnType<typeof spawn>;

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const application = resolve(__dirname, "src-tauri/target/debug/data-port");

export const config: Options.Testrunner = {
  hostname: "127.0.0.1",
  port: 4444,
  specs: ["./tests/e2e/**/*.spec.ts"],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": { application },
    } as WebdriverIO.Capabilities,
  ],
  logLevel: "warn",
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
  async onPrepare() {
    spawnSync("pkill", ["-f", "tauri-driver"]);
    tauriDriver = spawn("tauri-driver", [], {
      stdio: [null, process.stdout, process.stderr],
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
  async onComplete() {
    tauriDriver?.kill();
  },
};
