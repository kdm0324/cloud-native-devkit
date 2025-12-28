import { generateProject, loadConfig } from "@local-dev/core";
import type { InfraSpec } from "@local-dev/core";

export const cmdGenerate = async (configPath: string, spec: InfraSpec, outDir: string) => {
  const cfg = loadConfig(configPath);
  generateProject(cfg, spec, outDir);
};