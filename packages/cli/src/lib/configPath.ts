import fs from "node:fs";
import path from "node:path";

/**
 * 어디서 실행되든(local repo root / packages/cli 등)
 * inputPath (기본: localdev.config.yaml)를 찾도록 한다.
 */
export const resolveConfigPath = (inputPath: string) => {
  // 절대경로면 그대로
  if (path.isAbsolute(inputPath)) return inputPath;

  // 1) 현재 작업 디렉토리 기준 존재하면 사용
  const fromCwd = path.resolve(process.cwd(), inputPath);
  if (fs.existsSync(fromCwd)) return fromCwd;

  // 2) 상위 디렉토리로 올라가며 탐색
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, inputPath);
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 못 찾으면 cwd 기준 경로 반환(에러 메시지 용)
  return fromCwd;
};
