import fs from "node:fs";
import yaml from "js-yaml";

export type LocalDevConfig = {
  helm: { repos: Array<{ name: string; url: string }> };
  infra: {
    namespaceDefault: string;
    releaseDefault: string;
    components: Record<
      string,
      {
        enabledDefault: boolean;
        chart: { name: string; repoName: string; version: string };
        ports: number[];
      }
    >;
  };
};

export const loadConfig = (configPath = "localdev.config.yaml"): LocalDevConfig => {
  if (!fs.existsSync(configPath)) {
    throw new Error(`config 파일을 찾을 수 없습니다: ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = yaml.load(raw) as LocalDevConfig;
  if (!parsed?.helm?.repos || !parsed?.infra?.components) {
    throw new Error(`config 형식이 올바르지 않습니다: ${configPath}`);
  }
  return parsed;
};

export const toRepoUrlMap = (cfg: LocalDevConfig) =>
  Object.fromEntries(cfg.helm.repos.map((r) => [r.name, r.url]));

export const getComponentKeys = (cfg: LocalDevConfig) =>
  Object.keys(cfg.infra.components) as Array<keyof typeof cfg.infra.components>;