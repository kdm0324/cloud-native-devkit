import { generateProject, loadConfig } from "@cloud-native-devkit/core";
import type { InfraSpec } from "@cloud-native-devkit/core";

export const cmdGenerate = async (
  configPath: string,
  spec: InfraSpec,
  outDir: string
) => {
  const cfg = loadConfig(configPath);
  generateProject(cfg, spec, outDir);
};
