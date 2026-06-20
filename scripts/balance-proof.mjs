// One-command balance evidence refresh.
// Runs the CLI gate, browser runtime gates, direct-input browser sampler, then audit.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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
const manualSheetPath = String(args["manual-sheet"] ?? "output/manual-balance-play-sheet.md");
const manualPlanPath = String(args["manual-plan"] ?? "output/manual-balance-play-plan.json");
const manualPreflightPath = String(args["manual-preflight"] ?? "output/manual-balance-preflight.json");
const manualNextPath = String(args["manual-next"] ?? "output/manual-balance-next.txt");
const manualNextJsonPath = String(args["manual-next-json"] ?? "output/manual-balance-next.json");
const browserScreenshots = String(args.screenshots ?? "output/browser-balance-shots");
const directScreenshots = String(args["direct-screenshots"] ?? "output/browser-direct-shots");
const directCodexLog = String(args["direct-codex-log"] ?? "output/codex-direct-playlog.json");
const balanceSeeds = Number(args.seeds ?? 30);
const directSeeds = Number(args["direct-seeds"] ?? 6);
const requireComplete = args["require-complete"] === "true" || args.assert === "true";
const checkManualArtifacts =
  args["check-manual-artifacts"] === "true" || args["manual-artifacts-check"] === "true";

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

function runCapture(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const { allowFailure = false, ...spawnOptions } = options;
    console.log(`\n$ ${[command, ...commandArgs].join(" ")}`);
    const child = spawn(command, commandArgs, {
      stdio: ["ignore", "pipe", "inherit"],
      shell: false,
      ...spawnOptions,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || allowFailure) resolve(stdout);
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

function writeTextFile(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

async function writeManualGuidanceArtifacts() {
  const manualPreflight = await runCapture("yarn", [
    "--silent",
    "manual-playlog",
    `--out=${manualPath}`,
    "--preflight-json",
  ], { allowFailure: true });
  writeTextFile(manualPreflightPath, manualPreflight);
  console.log(`\n수동 플레이 preflight JSON 저장: ${manualPreflightPath}`);
  const manualNext = await runCapture("yarn", [
    "manual-playlog",
    `--out=${manualPath}`,
    "--next",
  ], { allowFailure: true });
  writeTextFile(manualNextPath, manualNext);
  console.log(`수동 플레이 다음 세션 저장: ${manualNextPath}`);
  const manualNextJson = await runCapture("yarn", [
    "--silent",
    "manual-playlog",
    `--out=${manualPath}`,
    "--next-json",
  ], { allowFailure: true });
  writeTextFile(manualNextJsonPath, manualNextJson);
  console.log(`수동 플레이 다음 세션 JSON 저장: ${manualNextJsonPath}`);
  const manualSheet = await runCapture("yarn", [
    "manual-playlog",
    `--out=${manualPath}`,
    "--sheet",
  ], { allowFailure: true });
  writeTextFile(manualSheetPath, manualSheet);
  console.log(`\n수동 플레이 시트 저장: ${manualSheetPath}`);
  const manualPlan = await runCapture("yarn", [
    "--silent",
    "manual-playlog",
    `--out=${manualPath}`,
    "--plan-json",
  ], { allowFailure: true });
  writeTextFile(manualPlanPath, manualPlan);
  console.log(`수동 플레이 계획 JSON 저장: ${manualPlanPath}`);
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function preflightSummary(payload) {
  return {
    logPath: payload.logPath ?? "",
    currentDataVersion: payload.currentDataVersion ?? "",
    logExists: Boolean(payload.logExists),
    canStart: Boolean(payload.canStart),
    blocking: Boolean(payload.blocking),
    invalidSessionCount: Number(payload.invalidSessionCount ?? 0),
    pendingCount: Number(payload.pendingCount ?? 0),
    totalMinutes: Number(payload.totalMinutes ?? 0),
    remainingMinutes: Number(payload.remainingMinutes ?? 0),
    targetRowsPassed: Number(payload.targetRowsPassed ?? 0),
    targetRowsTotal: Number(payload.targetRowsTotal ?? 0),
    nextLabel: payload.next?.label ?? "",
  };
}

function planSummary(payload) {
  const current = payload.current ?? {};
  return {
    passed: Boolean(payload.passed),
    steps: Array.isArray(payload.steps) ? payload.steps.length : 0,
    remainingMinutes: Number(current.remainingMinutes ?? 0),
    targetRowsPassed: Number(current.targetRowsPassed ?? 0),
    targetRowsTotal: Number(current.targetRowsTotal ?? 0),
    nextLabel: current.next?.label ?? "",
  };
}

function nextSummary(payload) {
  const current = payload.current ?? {};
  return {
    passed: Boolean(payload.passed),
    blockedByPendingStartMarkers: Boolean(payload.blockedByPendingStartMarkers),
    validSessionCount: Number(current.validSessionCount ?? 0),
    totalMinutes: Number(current.totalMinutes ?? 0),
    remainingMinutes: Number(current.remainingMinutes ?? 0),
    targetRowsPassed: Number(current.targetRowsPassed ?? 0),
    targetRowsTotal: Number(current.targetRowsTotal ?? 0),
    nextLabel: payload.next?.label ?? "",
    checklistCount: Array.isArray(payload.resultFieldChecklist) ? payload.resultFieldChecklist.length : 0,
  };
}

function assertSameSummary(name, expected, actual) {
  const mismatches = Object.keys(expected).filter((key) => expected[key] !== actual[key]);
  if (mismatches.length) {
    throw new Error(`${name} artifact mismatch: ${mismatches
      .map((key) => `${key} live=${expected[key]} file=${actual[key]}`)
      .join(", ")}`);
  }
}

async function checkManualGuidanceArtifacts() {
  const missing = [manualPreflightPath, manualNextPath, manualNextJsonPath, manualSheetPath, manualPlanPath]
    .filter((path) => !existsSync(path));
  if (missing.length) {
    throw new Error(`수동 proof artifact 누락: ${missing.join(", ")}\n갱신 명령: yarn balance-proof --require-complete`);
  }

  const livePreflightText = await runCapture("yarn", [
    "--silent",
    "manual-playlog",
    `--out=${manualPath}`,
    "--preflight-json",
  ], { allowFailure: true });
  const liveNextJsonText = await runCapture("yarn", [
    "--silent",
    "manual-playlog",
    `--out=${manualPath}`,
    "--next-json",
  ], { allowFailure: true });
  const livePlanText = await runCapture("yarn", [
    "--silent",
    "manual-playlog",
    `--out=${manualPath}`,
    "--plan-json",
  ], { allowFailure: true });

  const livePreflight = preflightSummary(JSON.parse(livePreflightText));
  const filePreflight = preflightSummary(readJsonFile(manualPreflightPath));
  assertSameSummary("manual preflight", livePreflight, filePreflight);

  const liveNext = nextSummary(JSON.parse(liveNextJsonText));
  const fileNext = nextSummary(readJsonFile(manualNextJsonPath));
  assertSameSummary("manual next", liveNext, fileNext);

  const livePlan = planSummary(JSON.parse(livePlanText));
  const filePlan = planSummary(readJsonFile(manualPlanPath));
  assertSameSummary("manual plan", livePlan, filePlan);

  const nextText = readFileSync(manualNextPath, "utf8");
  if (!nextText.includes("# 다음 수동 플레이 세션")) {
    throw new Error(`manual next artifact mismatch: missing next title in ${manualNextPath}`);
  }
  if (livePreflight.nextLabel && !nextText.includes(livePreflight.nextLabel)) {
    throw new Error(`manual next artifact mismatch: missing next target "${livePreflight.nextLabel}" in ${manualNextPath}`);
  }

  const sheet = readFileSync(manualSheetPath, "utf8");
  if (!sheet.includes("# 수동 밸런스 플레이 시트")) {
    throw new Error(`manual sheet artifact mismatch: missing sheet title in ${manualSheetPath}`);
  }
  if (livePreflight.nextLabel && !sheet.includes(livePreflight.nextLabel)) {
    throw new Error(`manual sheet artifact mismatch: missing next target "${livePreflight.nextLabel}" in ${manualSheetPath}`);
  }

  console.log(`\n수동 proof artifact 최신: ${manualPreflightPath}, ${manualNextPath}, ${manualNextJsonPath}, ${manualSheetPath}, ${manualPlanPath}`);
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
  if (checkManualArtifacts) {
    await checkManualGuidanceArtifacts();
  } else {
    if (requireComplete) {
      await writeManualGuidanceArtifacts();
      await run("yarn", ["manual-playlog", `--out=${manualPath}`, "--assert"]);
    }

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
      `--screenshots=${directScreenshots}`,
      `--codex-log=${directCodexLog}`,
    ]);
    await run("yarn", [
      "balance-audit",
      `--balance=${balancePath}`,
      `--browser=${browserPath}`,
      `--direct=${directPath}`,
      `--manual=${manualPath}`,
      `--codex=${directCodexLog}`,
      `--out=${auditPath}`,
      ...(requireComplete ? ["--assert"] : []),
    ]);
    if (!requireComplete) await writeManualGuidanceArtifacts();

    console.log(requireComplete
      ? `\n밸런스 완료 증거 검증 완료: ${auditPath}`
      : `\n밸런스 증거 갱신 완료: ${auditPath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await stopDevServer(devServer);
}
