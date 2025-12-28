import { spawn } from "node:child_process";

export const spawnDetached = (cmd: string, args: string[]) => {
  const child = spawn(cmd, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return child.pid;
};
