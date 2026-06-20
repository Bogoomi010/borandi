import type { DifficultyId } from "./types";

export interface ManualProofStartCommandInput {
  difficultyId: DifficultyId;
  stageId: number;
  seed: string;
  startedAt: string;
  notes?: string;
}

export function shellArg(value: unknown): string {
  const text = String(value);
  return `'${text.replace(/'/g, "'\\''")}'`;
}

export function manualStartId(
  difficultyId: DifficultyId,
  stageId: number,
  seed: string,
  startedAt: string,
): string {
  return `${difficultyId}-${stageId}-${seed}-${Date.parse(startedAt)}`;
}

export function manualStartCommand(input: ManualProofStartCommandInput): string {
  const id = manualStartId(input.difficultyId, input.stageId, input.seed, input.startedAt);
  const args = [
    "yarn manual-playlog --start",
    `--id=${shellArg(id)}`,
    `--difficulty=${input.difficultyId}`,
    `--stage=${input.stageId}`,
    `--seed=${shellArg(input.seed)}`,
    `--startedAt=${shellArg(input.startedAt)}`,
  ];
  if (input.notes) args.push(`--notes=${shellArg(input.notes)}`);
  return args.join(" ");
}

export function manualStartNextCommand(input: ManualProofStartCommandInput): string {
  const id = manualStartId(input.difficultyId, input.stageId, input.seed, input.startedAt);
  return [
    "yarn manual-playlog --start-next",
    `--id=${shellArg(id)}`,
    `--difficulty=${input.difficultyId}`,
    `--stage=${input.stageId}`,
    `--seed=${shellArg(input.seed)}`,
    `--startedAt=${shellArg(input.startedAt)}`,
  ].join(" ");
}

export function manualPendingIdCommand(input: ManualProofStartCommandInput): string {
  const id = manualStartId(input.difficultyId, input.stageId, input.seed, input.startedAt);
  return `yarn manual-playlog --pending-id=${shellArg(id)}`;
}

export function manualPreflightCommand(): string {
  return "yarn manual-playlog --preflight";
}

export function manualPreflightJsonCommand(): string {
  return "yarn --silent manual-playlog --preflight-json";
}

export function manualNextCommand(): string {
  return "yarn manual-playlog --next";
}

export function manualNextJsonCommand(): string {
  return "yarn --silent manual-playlog --next-json";
}

export function manualSummaryCommand(): string {
  return "yarn manual-playlog --summary";
}

export function manualSummaryJsonCommand(): string {
  return "yarn --silent manual-playlog --summary-json";
}

export function manualPlanCommand(): string {
  return "yarn manual-playlog --plan";
}

export function manualPlanJsonCommand(): string {
  return "yarn --silent manual-playlog --plan-json";
}

export function manualSheetCommand(): string {
  return "yarn manual-playlog --sheet";
}

export function manualDryRunCommand(command: string): string {
  const separator = " && ";
  const separatorIndex = command.indexOf(separator);
  if (separatorIndex < 0) return `${command} --dry-run`;
  return `${command.slice(0, separatorIndex)} --dry-run${command.slice(separatorIndex)}`;
}
