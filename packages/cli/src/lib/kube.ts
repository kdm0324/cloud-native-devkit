import { execa } from "execa";

export const requireCluster = async () => {
  const r = await execa("kubectl", ["get", "nodes"], {
    stdio: "inherit",
    reject: false,
  });
  if (r.exitCode !== 0) {
    throw new Error(
      "Kubernetes API에 연결할 수 없습니다. (예: Rancher Desktop에서 Kubernetes 활성화 확인)"
    );
  }
};

export const getServicesJson = async (ns: string) => {
  const r = await execa("kubectl", ["-n", ns, "get", "svc", "-o", "json"], {
    stdio: "pipe",
  });
  return JSON.parse(r.stdout);
};
