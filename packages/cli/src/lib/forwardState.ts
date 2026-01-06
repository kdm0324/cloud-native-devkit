import fs from "node:fs";
import path from "node:path";

export type ForwardItem = {
  key: string;
  pid: number;
  localPort: number;
  remotePort: number;
  svc: string;
};

export type ForwardState = {
  namespace: string;
  release?: string;
  startedAt: string; // ISO
  items: ForwardItem[];
};

const DIR_NAME = ".infra";
const FILE_NAME = "forwards.json";

const resolvePaths = () => {
  const dir = path.resolve(process.cwd(), DIR_NAME);
  const file = path.join(dir, FILE_NAME);
  return { dir, file };
};

const ensureDir = (dir: string) => fs.mkdirSync(dir, { recursive: true });

const writeJsonAtomic = (filePath: string, data: unknown) => {
  const dir = path.dirname(filePath);
  ensureDir(dir);

  const tmp = path.join(dir, `${FILE_NAME}.${process.pid}.${Date.now()}.tmp`);

  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
};

const readJsonSafe = <T>(filePath: string): T | null => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const saveForwards = (s: ForwardState) => {
  const { file } = resolvePaths();
  writeJsonAtomic(file, s);
};

export const loadForwards = (): ForwardState | null => {
  const { file } = resolvePaths();
  return readJsonSafe<ForwardState>(file);
};

export const clearForwards = () => {
  const { file } = resolvePaths();
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // best-effort
  }
};

export const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * 상태 파일이 있는데 모두 죽어있으면 자동 정리 (status UX 개선용)
 */
export const cleanupIfAllDead = () => {
  const s = loadForwards();
  if (!s) return false;

  const alive = s.items?.some((it) => isAlive(it.pid)) ?? false;
  if (!alive) {
    clearForwards();
    return true;
  }
  return false;
};
