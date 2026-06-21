declare module "node:fs" {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string, encoding: "utf8"): void;
}

declare module "node:path" {
  export function dirname(path: string): string;
}
