import fs from "node:fs";
import path from "node:path";
import type { InfraSpec } from "@cloud-native-devkit/core";

const STATE_DIR = ".infra";
const STATE_PATH = path.join(STATE_DIR, "state.json");
const SPEC_PATH = path.join(STATE_DIR, "spec.json");

export const ensureStateDir = () =>
  fs.mkdirSync(STATE_DIR, { recursive: true });

export const saveState = (s: { namespace: string; release: string }) => {
  ensureStateDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2), "utf-8");
};

export const loadState = () => {
  if (!fs.existsSync(STATE_PATH))
    throw new Error(
      `state 파일이 없습니다. 먼저 'cnd init'을 실행하세요. (${STATE_PATH})`
    );
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as {
    namespace: string;
    release: string;
  };
};

export const saveSpec = (spec: InfraSpec) => {
  ensureStateDir();
  fs.writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2), "utf-8");
};

export const loadSpec = () => {
  if (!fs.existsSync(SPEC_PATH))
    throw new Error(
      `spec 파일이 없습니다. 먼저 'cnd init'을 실행하세요. (${SPEC_PATH})`
    );
  return JSON.parse(fs.readFileSync(SPEC_PATH, "utf-8")) as InfraSpec;
};
