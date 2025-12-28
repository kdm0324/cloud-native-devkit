import fs from "node:fs";
import path from "node:path";

const DIR = ".infra";
const FILE = path.join(DIR, "forwards.json");

export type ForwardItem = {
  key: string;
  pid: number;
  localPort: number;
  remotePort: number;
  svc: string;
};

export type ForwardState = {
  namespace: string;
  startedAt: string;
  items: ForwardItem[];
};

export const saveForwards = (s: ForwardState) => {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2), "utf-8");
};

export const loadForwards = (): ForwardState | null => {
  if (!fs.existsSync(FILE)) return null;
  return JSON.parse(fs.readFileSync(FILE, "utf-8"));
};

export const clearForwards = () => {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
};

export const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
