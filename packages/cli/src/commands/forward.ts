import { execa } from "execa";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "@local-dev/core";
import type { InfraComponentKey } from "@local-dev/core";

import { section, step, ok, warn, info, fail } from "../lib/io.js";
import { requireCluster, getServicesJson } from "../lib/kube.js";
import { loadState, loadSpec } from "../lib/state.js";

type SvcItem = {
  metadata: { name: string; labels?: Record<string, string> };
  spec?: { ports?: Array<{ port: number; name?: string }> };
};

type ForwardItem = {
  key: InfraComponentKey;
  pid: number;
  localPort: number;
  remotePort: number;
  svc: string;
};

type ForwardState = {
  namespace: string;
  release: string;
  startedAt: string;
  items: ForwardItem[];
};

const FORWARD_DIR = ".infra";
const FORWARD_PATH = path.join(FORWARD_DIR, "forwards.json");

const ensureDir = () => fs.mkdirSync(FORWARD_DIR, { recursive: true });

const saveForwards = (s: ForwardState) => {
  ensureDir();
  fs.writeFileSync(FORWARD_PATH, JSON.stringify(s, null, 2), "utf-8");
};

const loadForwards = (): ForwardState | null => {
  if (!fs.existsSync(FORWARD_PATH)) return null;
  return JSON.parse(fs.readFileSync(FORWARD_PATH, "utf-8"));
};

const clearForwards = () => {
  if (fs.existsSync(FORWARD_PATH)) fs.unlinkSync(FORWARD_PATH);
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const parseMapArg = (s?: string) => {
  // 예: "redis=16379,kafka=19092"
  const map = new Map<string, number>();
  if (!s) return map;

  for (const part of s.split(",")) {
    const [kRaw, vRaw] = part.split("=");
    if (!kRaw || !vRaw) continue;

    const k = kRaw.trim();
    const n = Number(vRaw.trim());
    if (!k || !Number.isFinite(n)) continue;

    map.set(k, n);
  }
  return map;
};

const svcHasPort = (svc: SvcItem, port: number) =>
  (svc.spec?.ports ?? []).some((p) => p.port === port);

const pickServiceFor = (
  services: SvcItem[],
  key: InfraComponentKey,
  remotePort: number
) => {
  // 1) 이름에 키가 들어가고 + 포트가 맞는 svc
  const byNameAndPort = services.find(
    (s) => s.metadata.name.includes(key) && svcHasPort(s, remotePort)
  );
  if (byNameAndPort) return byNameAndPort.metadata.name;

  // 2) 포트만 맞는 svc (kafka 같은 케이스 대비)
  const byPort = services.find((s) => svcHasPort(s, remotePort));
  if (byPort) return byPort.metadata.name;

  // 3) 이름만 맞는 svc
  const byName = services.find((s) => s.metadata.name.includes(key));
  if (byName) return byName.metadata.name;

  return null;
};

const buildTargets = (
  cfg: ReturnType<typeof loadConfig>,
  spec: ReturnType<typeof loadSpec>,
  only?: string
) => {
  const allKeys = Object.keys(cfg.infra.components) as InfraComponentKey[];
  const enabledKeys = allKeys.filter((k) => spec.components?.[k]?.enabled);

  const onlySet = new Set(
    (only
      ? only
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : enabledKeys) as string[]
  );

  return enabledKeys.filter((k) => onlySet.has(k));
};

const spawnDetachedKubectlPortForward = (
  ns: string,
  svcName: string,
  localPort: number,
  remotePort: number
) => {
  const args = [
    "-n",
    ns,
    "port-forward",
    `svc/${svcName}`,
    `${localPort}:${remotePort}`,
  ];

  const child = spawn("kubectl", args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return child.pid ?? null;
};

/**
 * start (foreground/background)
 */
const forwardStart = async (
  configPath: string,
  opts: { map?: string; only?: string; bg?: boolean }
) => {
  section(`forward: kubectl port-forward${opts.bg ? " (bg)" : ""}`);

  await requireCluster();
  ok("Kubernetes API 연결 OK");

  const st = loadState(); // { namespace, release }
  const spec = loadSpec(); // enabled component 판단용
  const cfg = loadConfig(configPath);

  const ns = st.namespace;
  const release = st.release;

  info(`namespace=${ns}, release=${release}`);

  const targets = buildTargets(cfg, spec, opts.only);

  if (targets.length === 0) {
    fail(
      "port-forward 대상이 없습니다.",
      "해결:\n- init에서 인프라를 하나 이상 선택하세요.\n- 또는 --only redis,kafka 처럼 지정하세요."
    );
  }

  step("서비스 목록 조회");
  const svcJson = await getServicesJson(ns);
  const services: SvcItem[] = svcJson.items ?? [];

  if (services.length === 0) {
    fail(
      `namespace(${ns})에 서비스가 없습니다.`,
      "먼저 up을 실행해 설치가 되었는지 확인하세요."
    );
  }

  // 로컬 포트 매핑
  const map = parseMapArg(opts.map);

  // bg 실행이면 기존 상태가 살아있는지 안내
  if (opts.bg) {
    const prev = loadForwards();
    if (prev?.items?.some((it) => isAlive(it.pid))) {
      warn("이미 백그라운드 포트포워딩이 실행 중인 것으로 보입니다.");
      info("확인: local-dev forward status");
      info("종료: local-dev forward stop");
    }
  }

  // foreground는 execa child로 유지 (Ctrl+C 처리)
  const fgChildren: Array<ReturnType<typeof execa>> = [];
  // background는 pid 저장
  const bgItems: ForwardItem[] = [];

  console.log(
    opts.bg
      ? "\n✅ 백그라운드 포트포워딩 시작\n"
      : "\n✅ 포트포워딩 시작(종료: Ctrl+C)\n"
  );

  for (const key of targets) {
    const remotePort = cfg.infra.components[key].ports?.[0];
    if (!remotePort) {
      warn(`${key}: config에 ports가 없습니다. skip`);
      continue;
    }

    const localPort = map.get(key) ?? remotePort;
    const svcName = pickServiceFor(services, key, remotePort);

    if (!svcName) {
      warn(
        `${key}: 매칭되는 Service를 찾지 못했습니다. (remotePort=${remotePort})`
      );
      continue;
    }

    ok(`${key}: svc/${svcName} ${localPort}:${remotePort}`);
    info(`접속: localhost:${localPort}`);

    if (opts.bg) {
      const pid = spawnDetachedKubectlPortForward(
        ns,
        svcName,
        localPort,
        remotePort
      );
      if (!pid) {
        warn(`${key}: port-forward 실행 실패(pid 없음)`);
        continue;
      }
      bgItems.push({ key, pid, localPort, remotePort, svc: svcName });
    } else {
      const child = execa(
        "kubectl",
        [
          "-n",
          ns,
          "port-forward",
          `svc/${svcName}`,
          `${localPort}:${remotePort}`,
        ],
        { stdio: "inherit" }
      );
      fgChildren.push(child);
    }
  }

  // bg: 상태 저장하고 종료
  if (opts.bg) {
    if (bgItems.length === 0) {
      fail(
        "백그라운드로 실행할 대상이 없습니다.",
        "서비스 매칭/포트 설정을 확인하세요."
      );
    }

    saveForwards({
      namespace: ns,
      release,
      startedAt: new Date().toISOString(),
      items: bgItems,
    });

    console.log("\n✅ 백그라운드 실행 완료");
    console.log("   - 상태: local-dev forward status");
    console.log("   - 종료: local-dev forward stop\n");
    return;
  }

  // foreground: Ctrl+C 처리
  const shutdown = () => {
    console.log("\n\n🛑 port-forward 종료 중...\n");

    for (const c of fgChildren) {
      try {
        c.kill("SIGINT");
        setTimeout(() => {
          try {
            if (c.exitCode == null) c.kill("SIGKILL");
          } catch {}
        }, 1000);
      } catch {}
    }

    setTimeout(() => process.exit(0), 1200);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 포그라운드는 계속 살아있게 대기
  await new Promise<void>(() => {});
};

/**
 * status
 */
const forwardStatus = async () => {
  section("forward: status");

  const s = loadForwards();
  if (!s) {
    warn("저장된 포트포워딩 상태가 없습니다.");
    info("시작: local-dev forward --bg");
    return;
  }

  info(`namespace=${s.namespace}, release=${s.release}`);
  info(`startedAt=${s.startedAt}\n`);

  for (const it of s.items) {
    const alive = isAlive(it.pid);
    console.log(
      `${alive ? "✅" : "❌"} ${it.key}: pid=${it.pid} localhost:${
        it.localPort
      } -> svc/${it.svc}:${it.remotePort}`
    );
  }

  console.log("");
};

/**
 * stop
 */
const forwardStop = async () => {
  section("forward: stop");

  const s = loadForwards();
  if (!s) {
    warn("중지할 포트포워딩 상태가 없습니다.");
    return;
  }

  let requested = 0;

  for (const it of s.items) {
    if (!isAlive(it.pid)) continue;

    try {
      process.kill(it.pid); // best-effort cross-platform
      requested++;
      ok(`${it.key}: pid=${it.pid} 종료 요청`);
    } catch {
      warn(`${it.key}: pid=${it.pid} 종료 실패(권한/이미 종료됨)`);
    }
  }

  clearForwards();
  console.log(`\n✅ stop 완료 (요청 ${requested}건)\n`);
};

/**
 * exported entry
 *
 * - cmdForward(configPath, opts) : start
 * - cmdForwardStatus()          : status
 * - cmdForwardStop()            : stop
 */
export const cmdForward = async (
  configPath: string,
  opts: { map?: string; only?: string; bg?: boolean }
) => forwardStart(configPath, opts);

export const cmdForwardStatus = async () => forwardStatus();
export const cmdForwardStop = async () => forwardStop();
