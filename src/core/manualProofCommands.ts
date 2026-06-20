import type { DifficultyId } from "./types";

export interface ManualProofStartCommandInput {
  difficultyId: DifficultyId;
  stageId: number;
  seed: string;
  startedAt: string;
  notes?: string;
}

export function shellArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
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
