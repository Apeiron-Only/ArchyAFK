import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import electronPath from "electron";

const children = [];
const nodeOptions = [process.env.NODE_OPTIONS, "--no-deprecation"].filter(Boolean).join(" ");
const npmCliPath =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

if (!existsSync(npmCliPath)) {
  console.error(`npm CLI bulunamadı: ${npmCliPath}`);
  process.exit(1);
}

const run = (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    windowsHide: true,
    ...options
  });
  children.push(child);
  return child;
};

const runNpmScript = (scriptName, extraArgs = [], options = {}) =>
  run(process.execPath, [npmCliPath, "run", scriptName, ...extraArgs], options);

const canUsePort = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });

const findDevPort = async () => {
  for (let port = 1420; port < 1500; port += 1) {
    if (await canUsePort(port)) {
      return port;
    }
  }
  throw new Error("1420-1499 aralığında boş geliştirme portu bulunamadı.");
};

const exitCode = (await once(runNpmScript("build:main"), "exit"))[0];
if (exitCode !== 0) {
  process.exit(Number(exitCode ?? 1));
}

const devPort = await findDevPort();
const devUrl = `http://127.0.0.1:${devPort}`;

const vite = runNpmScript("dev:renderer", ["--", "--port", String(devPort)], {
  env: { ...process.env, FORCE_COLOR: "1", NODE_NO_WARNINGS: "1" }
});

const waitForRenderer = async () => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(devUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Renderer geliştirme sunucusu zamanında hazır olmadı.");
};

try {
  await waitForRenderer();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  vite.kill();
  process.exit(1);
}

const electron = run(electronPath, ["."], {
  env: {
    ...process.env,
    ELECTRON_RENDERER_URL: devUrl,
    NODE_OPTIONS: nodeOptions,
    NODE_NO_WARNINGS: "1"
  }
});

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);

const [code] = await once(electron, "exit");
shutdown();
process.exit(Number(code ?? 0));
