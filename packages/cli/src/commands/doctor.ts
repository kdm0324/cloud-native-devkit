import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import { loadConfig } from "@cloud-native-devkit/core";

type DoctorEnv = "none" | "k3d" | "rancher";

type DoctorOptions = {
  env?: DoctorEnv;
  requireCluster?: boolean;
};

const line = (s = "") => console.log(s);

const run = async (cmd: string, args: string[]) =>
  execa(cmd, args, { stdio: "pipe", reject: false });

const checkCmd = async (name: string, cmd: string, args: string[]) => {
  const r = await run(cmd, args);
  const ok = r.exitCode === 0;
  line(`${ok ? "✅" : "❌"} ${name}`);
  return ok;
};

const existsFile = (p: string) => fs.existsSync(p) && fs.statSync(p).isFile();

const normalizeEnv = (env?: string): DoctorEnv => {
  if (!env) return "none";
  const v = env.toLowerCase();
  if (v === "k3d") return "k3d";
  if (v === "rancher") return "rancher";
  return "none";
};

const printCommonNext = () => {
  line("\n다음 단계(클러스터 연결 가능 환경에서):");
  line("- init:     cnd init");
  line("- up:       cnd up");
  line("- info:     cnd info");
  line("- forward:  cnd forward");
};

const printK3dGuide = () => {
  line("\n[k3d 가이드]");
  line("- k3d는 Docker daemon이 필요합니다.");
  line("- macOS(가벼운 구성): Colima + docker + k3d");
  line("  brew install colima docker k3d kubectl helm");
  line("  colima start");
  line("  k3d cluster create localdev");
  line("  kubectl config use-context k3d-localdev");
  line("  kubectl get nodes");
};

const printRancherGuide = () => {
  line("\n[Rancher Desktop 가이드]");
  line("- Rancher Desktop 실행 → Settings에서 Kubernetes Enable(k3s)");
  line("- 이후 확인:");
  line("  kubectl config get-contexts");
  line("  kubectl get nodes");
  line(
    "- container runtime이 containerd면 nerdctl을 함께 쓸 수 있습니다(선택)."
  );
};

const tryGetKubeContext = async () => {
  const r = await run("kubectl", ["config", "current-context"]);
  if (r.exitCode !== 0) return "";
  return (r.stdout ?? "").trim();
};

const tryCheckCluster = async () => {
  const r = await execa("kubectl", ["get", "nodes"], {
    stdio: "ignore",
    reject: false,
  });
  return r.exitCode === 0;
};

const checkDockerDaemon = async () => {
  const cli = await run("docker", ["version"]);
  const okCli = cli.exitCode === 0;

  if (!okCli) {
    line("❌ docker (cli)");
    return { okCli: false, okDaemon: false };
  }
  line("✅ docker (cli)");

  const ps = await run("docker", ["ps"]);
  const okDaemon = ps.exitCode === 0;
  line(`${okDaemon ? "✅" : "❌"} docker daemon`);

  return { okCli: true, okDaemon };
};

const checkBinary = async (name: string, cmd: string) => {
  const r = await run(cmd, ["--version"]);
  const ok = r.exitCode === 0;
  line(`${ok ? "✅" : "❌"} ${name}`);
  return ok;
};

const printDiagram = (p: {
  ctx: string;
  clusterOk: boolean;
  namespace: string;
  enabledKeys: string[];
}) => {
  line("\n[Diagram]");
  line(`Local Machine (${os.platform()} ${os.arch()})`);
  line("  |");
  line(`  | kubectl -> context: ${p.ctx || "(none)"}`);
  line("  v");
  if (!p.ctx) {
    line("Kubernetes Cluster: (not connected)");
    return;
  }
  line(`Kubernetes Cluster: ${p.clusterOk ? "OK" : "FAIL"}`);
  line(`  └─ namespace: ${p.namespace}`);
  if (p.enabledKeys.length > 0) {
    line(`       └─ enabled: ${p.enabledKeys.join(", ")}`);
  } else {
    line("       └─ enabled: (none)  // run `cnd init` first");
  }
};

export const cmdDoctor = async (
  configPath: string,
  options: DoctorOptions = {}
) => {
  const env = normalizeEnv(options.env);

  line("\n[doctor] 필수 도구 체크\n");

  const okHelm = await checkCmd("helm", "helm", ["version"]);
  const okKubectl = await checkCmd("kubectl (client)", "kubectl", [
    "version",
    "--client",
  ]);

  // config 파일 존재 + 로딩 체크
  const absConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  const okConfigExists = existsFile(absConfigPath);
  line(`${okConfigExists ? "✅" : "❌"} config 파일 존재: ${absConfigPath}`);

  let okConfigLoad = false;
  let namespaceDefault = "local-infra";
  if (okConfigExists) {
    try {
      const cfg = loadConfig(absConfigPath);
      const okRepoCfg =
        Array.isArray(cfg.helm?.repos) && cfg.helm.repos.length > 0;
      okConfigLoad = true;

      namespaceDefault = cfg.infra?.namespaceDefault ?? namespaceDefault;

      line(`${okRepoCfg ? "✅" : "❌"} config helm.repos 설정`);
      line("\n[doctor] repo URL 요약");
      for (const r of cfg.helm.repos) line(`- ${r.name}: ${r.url}`);

      if (!okRepoCfg) {
        line("\n⚠️ helm.repos가 비어있습니다. repo를 설정하세요.");
      }
    } catch (e: any) {
      line(`❌ config 로딩 실패: ${e?.message ?? String(e)}`);
    }
  }

  line("\n[doctor] Kubernetes 연결 상태(선택)\n");

  const ctx = await tryGetKubeContext();
  const clusterOk = ctx ? await tryCheckCluster() : false;

  // enabled keys 추정 (spec 있으면 표시, 없으면 empty)
  const specPath = path.resolve(".infra/spec.json");
  let enabledKeys: string[] = [];
  if (existsFile(specPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(specPath, "utf-8"));
      const comps = raw?.components ?? {};
      enabledKeys = Object.keys(comps).filter((k) => comps?.[k]?.enabled);
    } catch {
      // ignore
    }
  }

  // 다이어그램 출력(항상)
  printDiagram({
    ctx,
    clusterOk,
    namespace: namespaceDefault,
    enabledKeys,
  });

  if (!ctx) {
    line(
      "\n⚠️ current-context가 없습니다. (kubectl config get-contexts 결과가 비어있을 가능성)"
    );
    line("   → up/forward는 '클러스터 연결 가능한 환경'에서만 동작합니다.");

    if (env === "k3d") printK3dGuide();
    else if (env === "rancher") printRancherGuide();
    else {
      line("\n로컬 클러스터를 만들 계획이라면:");
      line("- k3d(가벼운 CLI):  cnd doctor --env k3d");
      line("- Rancher Desktop: cnd doctor --env rancher");
    }

    if (!okHelm || !okKubectl || !okConfigExists || !okConfigLoad) {
      throw new Error(
        "doctor 실패: 위 필수 항목(helm/kubectl/config)을 해결한 뒤 다시 실행하세요."
      );
    }

    if (options.requireCluster) {
      throw new Error(
        "doctor 실패: --require-cluster 옵션이 켜져있지만 current-context가 없습니다."
      );
    }

    line(
      "\n✅ doctor OK (단, 클러스터 연결이 없어 up/forward는 여기서 실행 불가)\n"
    );
    return;
  }

  line(`\n✅ current-context: ${ctx}`);
  line(`${clusterOk ? "✅" : "❌"} kubectl get nodes`);

  if (env === "k3d") {
    line("\n[doctor] k3d 환경 체크(선택)\n");
    await checkBinary("k3d", "k3d");
    await checkDockerDaemon();
    if (!clusterOk) printK3dGuide();
  }

  if (env === "rancher") {
    line("\n[doctor] Rancher Desktop 환경 체크(선택)\n");
    await checkCmd("rdctl (optional)", "rdctl", ["version"]);
    await checkCmd("nerdctl (optional)", "nerdctl", ["version"]);
    if (!clusterOk) printRancherGuide();
  }

  if (!okHelm || !okKubectl || !okConfigExists || !okConfigLoad) {
    throw new Error(
      "doctor 실패: 위 필수 항목(helm/kubectl/config)을 해결한 뒤 다시 실행하세요."
    );
  }

  if (options.requireCluster && !clusterOk) {
    throw new Error(
      "doctor 실패: --require-cluster 옵션이 켜져있지만 클러스터 연결이 실패했습니다."
    );
  }

  line("\n✅ doctor OK\n");
  if (clusterOk) printCommonNext();
  else
    line(
      "\n⚠️ 클러스터 연결이 없어 up/forward는 실패합니다. (kubeconfig/클러스터 상태 확인)\n"
    );
};
