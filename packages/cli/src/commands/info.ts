import { loadConfig } from "@local-dev/core";
import type { InfraComponentKey } from "@local-dev/core";
import { section, step, ok, info, warn } from "../lib/io.js";
import { getServicesJson, requireCluster } from "../lib/kube.js";
import { loadState, loadSpec } from "../lib/state.js";

export const cmdInfo = async (configPath: string) => {
  section("info: 현재 상태/접속 정보");

  const st = loadState();
  const spec = loadSpec();
  const cfg = loadConfig(configPath);

  info(`namespace=${st.namespace}, release=${st.release}`);

  const keys = Object.keys(cfg.infra.components) as InfraComponentKey[];
  const enabled = keys.filter((k) => spec.components?.[k]?.enabled);

  step("선택된 인프라");
  if (enabled.length === 0) warn("선택된 인프라 없음 (init 다시 실행 필요)");
  else
    enabled.forEach((k) =>
      ok(`${k} (port ${cfg.infra.components[k].ports?.[0] ?? "?"})`)
    );

  step("서비스 조회(가능하면)");
  try {
    await requireCluster();
    const svcJson = await getServicesJson(st.namespace);
    const items = svcJson.items ?? [];
    if (items.length === 0)
      warn("서비스가 없습니다. up 실행 여부를 확인하세요.");
    else {
      for (const s of items) {
        const ports = (s.spec?.ports ?? []).map((p: any) => p.port).join(", ");
        console.log(`- ${s.metadata.name}  [${ports}]`);
      }
    }
  } catch {
    warn("Kubernetes 연결이 없어 서비스 조회는 생략했습니다.");
  }

  console.log(`
추천 다음 명령:
- up(설치):     npm run dev:cli -- up
- forward(접속): npm run dev:cli -- forward
- forward(포트변경): npm run dev:cli -- forward -- --map "kafka=19092,redis=16379"
`);
};
