import path from "node:path";
import { Command } from "commander";
import { resolveConfigPath } from "./lib/configPath.js";
import { fail } from "./lib/io.js";

import { cmdDoctor } from "./commands/doctor.js";
import { cmdInit } from "./commands/init.js";
import { cmdGenerate } from "./commands/generate.js";
import { cmdUp } from "./commands/up.js";
import { cmdDown } from "./commands/down.js";
import { cmdInfo } from "./commands/info.js";
import { loadSpec } from "./lib/state.js";
import {
  cmdForward,
  cmdForwardStatus,
  cmdForwardStop,
} from "./commands/forward.js";

// ✅ npm workspace 실행 시에도 “명령을 실행한 디렉토리” 기준으로 동작하게
const initCwd = process.env.INIT_CWD;
if (initCwd) process.chdir(initCwd);

const isNpmRun = Boolean(process.env.npm_lifecycle_event);

// 실행된 바이너리 이름(cnd/cnctl)을 help/힌트에 반영
const invoked = (() => {
  const raw = process.argv[1] ?? "cnd";
  const base = path.basename(raw);
  return base.endsWith(".exe") ? base.slice(0, -4) : base;
})();
const runtimeCmd = invoked || "cnd";

const hint = (cmd: string) =>
  isNpmRun ? `npm run dev:cli -- ${cmd}` : `${runtimeCmd} ${cmd}`;

const program = new Command();

program
  .name(runtimeCmd)
  .description("cloud-native-devkit: Local dev infra installer + port-forward")
  // ✅ config 파일명에서 local-dev 흔적 제거
  .option("-c, --config <path>", "config yaml path", "cnd.config.yaml");

/**
 * doctor
 */
program
  .command("doctor")
  .description(
    "Check required tools and show next steps (supports --env k3d|rancher)"
  )
  .option("--env <env>", "environment hint: k3d | rancher", "none")
  .option("--require-cluster", "fail if cluster is not reachable", false)
  .action(async (opts) => {
    const { config } = program.opts<{ config: string }>();
    const configPath = resolveConfigPath(config);

    await cmdDoctor(configPath, {
      env: opts.env,
      requireCluster: opts.requireCluster,
    });
  });

/**
 * init
 */
program
  .command("init")
  .description("Interactive init -> generate files")
  .option("-o, --out <dir>", "output directory", ".")
  .action(async (opts) => {
    const { config } = program.opts<{ config: string }>();
    const configPath = resolveConfigPath(config);

    const spec = await cmdInit(configPath);
    await cmdGenerate(configPath, spec, opts.out);

    console.log(`\n✅ init + generate 완료.`);
    console.log(`다음: ${hint("up")}\n`);
  });

/**
 * generate
 */
program
  .command("generate")
  .description("Generate files from saved spec (.infra/spec.json)")
  .option("-o, --out <dir>", "output directory", ".")
  .action(async (opts) => {
    const { config } = program.opts<{ config: string }>();
    const configPath = resolveConfigPath(config);

    const spec = loadSpec();
    await cmdGenerate(configPath, spec, opts.out);

    console.log("\n✅ generate 완료\n");
  });

/**
 * up / down
 */
program
  .command("up")
  .description("Helm install/upgrade infra")
  .action(async () => {
    const { config } = program.opts<{ config: string }>();
    const configPath = resolveConfigPath(config);
    await cmdUp(configPath);
  });

program
  .command("down")
  .description("Helm uninstall infra")
  .action(async () => {
    await cmdDown();
  });

/**
 * info
 */
program
  .command("info")
  .description("Show selected infra, services, and next commands")
  .action(async () => {
    const { config } = program.opts<{ config: string }>();
    const configPath = resolveConfigPath(config);
    await cmdInfo(configPath);
  });

/**
 * forward (single command + subcommands)
 */
const forward = program
  .command("forward")
  .description("Port-forward enabled infra services");

// 기본: cnd forward == start
forward
  .option("--bg", "run in background")
  .option("--map <map>", 'local port map. ex) "redis=16379,kafka=19092"')
  .option("--only <keys>", 'only these components. ex) "redis,kafka"')
  .action(async (opts) => {
    const { config } = program.opts<{ config: string }>();
    const configPath = resolveConfigPath(config);
    await cmdForward(configPath, opts);
  });

forward
  .command("start")
  .description(
    "Start port-forward (default: foreground; use --bg for background)"
  )
  .option("--bg", "run in background")
  .option("--map <map>", 'local port map. ex) "redis=16379,kafka=19092"')
  .option("--only <keys>", 'only these components. ex) "redis,kafka"')
  .action(async (opts) => {
    const { config } = program.opts<{ config: string }>();
    const configPath = resolveConfigPath(config);
    await cmdForward(configPath, opts);
  });

forward
  .command("status")
  .description("Show background port-forward status (.infra/forwards.json)")
  .action(async () => {
    await cmdForwardStatus();
  });

forward
  .command("stop")
  .description("Stop background port-forward processes")
  .action(async () => {
    await cmdForwardStop();
  });

program.parseAsync(process.argv).catch((e) => fail(e?.message ?? String(e)));
