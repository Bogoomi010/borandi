// One-command balance evidence refresh.
// Runs the CLI gate, browser runtime gates, direct-input browser sampler, then audit.

import { spawn } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const host = String(args.host ?? "127.0.0.1");
const port = Number(args.port ?? 1421);
const url = String(args.url ?? `http://${host}:${port}/`);
const balancePath = String(args.balance ?? "output/current-balance.json");
const browserPath = String(args.browser ?? "output/browser-balance.json");
const directPath = String(args.direct ?? "output/browser-direct.json");
const manualPath = String(args.manual ?? "output/manual-balance-playlog.json");
const auditPath = String(args.out ?? "output/balance-audit.md");
const browserScreenshots = String(args.screenshots ?? "output/browser-balance-shots");
const balanceSeeds = Number(args.seeds ?? 30);
const directSeeds = Number(args["direct-seeds"] ?? 2);
const requireComplete = args["require-complete"] === "true" || args.assert === "true";

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...commandArgs].join(" ")}`);
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

async function canReachServer() {
  let timer = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function startDevServer() {
  console.log(`\n$ yarn dev --host ${host} --port ${port}`);
  const child = spawn("yarn", ["dev", "--host", host, "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    shell: false,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) throw new Error(`dev server exited with ${child.exitCode}`);
    if (await canReachServer()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`dev server did not become reachable at ${url}`);
}

function signalDevServer(child, signal) {
  try {
    if (child.pid) process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Ignore shutdown races.
    }
  }
}

function waitForExit(child, timeoutMs) {
  if (!child || child.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timer);
      resolve(true);
    }
    child.once("exit", onExit);
  });
}

async function stopDevServer(child) {
  if (!child || child.exitCode !== null) return;
  signalDevServer(child, "SIGINT");
  if (await waitForExit(child, 2500)) return;
  signalDevServer(child, "SIGTERM");
  if (await waitForExit(child, 1500)) return;
  signalDevServer(child, "SIGKILL");
  await waitForExit(child, 500);
}

let devServer = null;
try {
  await run("yarn", ["balance", `--seeds=${balanceSeeds}`, `--json=${balancePath}`]);

  if (await canReachServer()) {
    console.log(`\n이미 실행 중인 개발 서버 사용: ${url}`);
  } else {
    devServer = startDevServer();
    await waitForServer(devServer);
  }

  await run("yarn", [
    "browser-balance",
    `--url=${url}`,
    `--json=${browserPath}`,
    `--screenshots=${browserScreenshots}`,
  ]);
  await run("yarn", [
    "browser-direct",
    `--url=${url}`,
    `--seeds=${directSeeds}`,
    "--strict",
    `--json=${directPath}`,
  ]);
  await run("yarn", [
    "balance-audit",
    `--balance=${balancePath}`,
    `--browser=${browserPath}`,
    `--direct=${directPath}`,
    `--manual=${manualPath}`,
    `--out=${auditPath}`,
    ...(requireComplete ? ["--assert"] : []),
  ]);

  console.log(requireComplete
    ? `\n밸런스 완료 증거 검증 완료: ${auditPath}`
    : `\n밸런스 증거 갱신 완료: ${auditPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await stopDevServer(devServer);
}
