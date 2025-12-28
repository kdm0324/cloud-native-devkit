import { checkbox, input, password } from "@inquirer/prompts";
import { loadConfig } from "@local-dev/core";
import type { InfraSpec, InfraComponentKey } from "@local-dev/core";
import { saveState, saveSpec } from "../lib/state.js";
import { info, ok } from "../lib/io.js";

export const cmdInit = async (configPath: string) => {
  const cfg = loadConfig(configPath);

  const namespace = await input({
    message: "Infra namespace",
    default: cfg.infra.namespaceDefault,
  });
  const release = await input({
    message: "Helm release",
    default: cfg.infra.releaseDefault,
  });

  const keys = Object.keys(cfg.infra.components) as InfraComponentKey[];

  const picked = await checkbox({
    message: "설치할 인프라 선택 (Space 체크/해제)",
    choices: keys.map((k) => ({
      name: k,
      value: k,
      checked: cfg.infra.components[k]?.enabledDefault ?? false,
    })),
    pageSize: 12,
  });

  const spec: InfraSpec = {
    namespace,
    release,
    components: keys.reduce((acc, k) => {
      acc[k] = { enabled: picked.includes(k) };
      return acc;
    }, {} as InfraSpec["components"]),
    credentials: {},
  };

  if (spec.components.mysql?.enabled) {
    const v = await password({
      message: "MySQL rootPassword (Enter = localpass)",
      mask: true,
    });
    spec.credentials.mysqlRootPassword = v?.trim() ? v.trim() : "localpass";
  }

  if (spec.components.postgresql?.enabled) {
    const v = await password({
      message: "PostgreSQL postgresPassword (Enter = localpass)",
      mask: true,
    });
    spec.credentials.postgresPassword = v?.trim() ? v.trim() : "localpass";
  }

  saveState({ namespace, release });
  saveSpec(spec);
  ok("spec 저장 완료: .infra/spec.json");
  info("다음: npm run dev:cli -- up (클러스터 준비된 환경에서)");
  return spec;
};
