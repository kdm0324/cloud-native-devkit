import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { loadConfig } from "@local-dev/core";

type DoctorEnv = "none" | "k3d" | "rancher";

type DoctorOptions = {
  env?: DoctorEnv;
  requireCluster?: boolean; // true면 클러스터 연결까지 필수(없으면 실패)
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
  line("- init:     local-dev init");
  line("- up:       local-dev up");
  line("- info:     local-dev info");
  line("- forward:  local-dev forward");
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
  // get nodes로 연결성 판단
  const r = await execa("kubectl", ["get", "nodes"], {
    stdio: "ignore",
    reject: false,
  });
  return r.exitCode === 0;
};

const checkDockerDaemon = async () => {
  // docker cli 존재 여부
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
  if (okConfigExists) {
    try {
      const cfg = loadConfig(absConfigPath);
      const okRepoCfg =
        Array.isArray(cfg.helm?.repos) && cfg.helm.repos.length > 0;
      okConfigLoad = true;

      line(`${okRepoCfg ? "✅" : "❌"} localdev.config.yaml helm.repos 설정`);
      line("\n[doctor] repo URL 요약");
      for (const r of cfg.helm.repos) line(`- ${r.name}: ${r.url}`);

      if (!okRepoCfg) {
        line("\n⚠️ helm.repos가 비어있습니다. repo를 설정하세요.");
      }
    } catch (e: any) {
      line(`❌ config 로딩 실패: ${e?.message ?? String(e)}`);
    }
  }

  // kubectl context / cluster 연결은 "안내"로 처리 (기본은 실패시키지 않음)
  line("\n[doctor] Kubernetes 연결 상태(선택)\n");

  const ctx = await tryGetKubeContext();
  if (!ctx) {
    line(
      "⚠️ current-context가 없습니다. (kubectl config get-contexts 결과가 비어있을 가능성)"
    );
    line("   → up/forward는 '클러스터 연결 가능한 환경'에서만 동작합니다.");

    // env 선택에 따라 더 친절하게 가이드 출력
    if (env === "k3d") printK3dGuide();
    else if (env === "rancher") printRancherGuide();
    else {
      line("\n로컬 클러스터를 만들 계획이라면:");
      line("- k3d(가벼운 CLI):  local-dev doctor --env k3d");
      line("- Rancher Desktop: local-dev doctor --env rancher");
    }

    if (!okHelm || !okKubectl || !okConfigExists || !okConfigLoad) {
      throw new Error(
        "doctor 실패: 위 필수 항목(helm/kubectl/config)을 해결한 뒤 다시 실행하세요."
      );
    }

    // requireCluster가 켜져 있으면 여기서 실패
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

  line(`✅ current-context: ${ctx}`);

  const clusterOk = await tryCheckCluster();
  line(`${clusterOk ? "✅" : "❌"} kubectl get nodes`);

  // env별 추가 체크(선택)
  if (env === "k3d") {
    line("\n[doctor] k3d 환경 체크(선택)\n");
    await checkBinary("k3d", "k3d");
    await checkDockerDaemon();
    if (!clusterOk) {
      printK3dGuide();
    }
  }

  if (env === "rancher") {
    line("\n[doctor] Rancher Desktop 환경 체크(선택)\n");
    // rdctl/nerdctl은 없어도 되지만 있으면 안내에 도움
    await checkCmd("rdctl (optional)", "rdctl", ["version"]);
    await checkCmd("nerdctl (optional)", "nerdctl", ["version"]);
    if (!clusterOk) {
      printRancherGuide();
    }
  }

  // 필수는 반드시 만족해야 함
  if (!okHelm || !okKubectl || !okConfigExists || !okConfigLoad) {
    throw new Error(
      "doctor 실패: 위 필수 항목(helm/kubectl/config)을 해결한 뒤 다시 실행하세요."
    );
  }

  // 클러스터까지 필수면 실패 처리
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
