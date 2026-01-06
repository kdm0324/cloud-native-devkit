import path from "node:path";
import { loadConfig } from "@cloud-native-devkit/core";
import { section, step, ok, warn, fail, info } from "../lib/io.js";
import { requireCluster } from "../lib/kube.js";
import { helmRepoSync, helmDepUpdate, helmUpsert } from "../lib/helm.js";
import { loadState } from "../lib/state.js";

export const cmdUp = async (configPath: string) => {
  section("up: Helm install/upgrade infra");

  step("Kubernetes 연결 확인");
  try {
    await requireCluster();
    ok("Kubernetes API 연결 OK");
  } catch {
    fail(
      "Kubernetes API에 연결할 수 없습니다.",
      [
        "",
        "확인 방법:",
        "  kubectl config current-context",
        "  kubectl get nodes",
        "",
        "권장:",
        "- 클러스터가 없다면, 클러스터가 있는 환경에서 실행하세요.",
      ].join("\n")
    );
  }

  step("state 로딩 (.infra/state.json)");
  const st = loadState();
  ok(`namespace=${st.namespace}, release=${st.release}`);

  const cfg = loadConfig(configPath);

  step("helm repo 동기화");
  await helmRepoSync(cfg.helm.repos);
  ok("helm repo sync 완료");

  step("helm dependency update (charts/infra)");
  await helmDepUpdate(path.resolve("charts/infra"));
  ok("dependency update 완료");

  step("helm upgrade --install");
  await helmUpsert(
    st.release,
    path.resolve("charts/infra"),
    st.namespace,
    path.resolve("infra-values.yaml")
  );

  ok("up 완료");
  info(`확인: kubectl -n ${st.namespace} get pods`);
};
