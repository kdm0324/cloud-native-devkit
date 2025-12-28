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
const hint = (cmd: string) =>
  isNpmRun ? `npm run dev:cli -- ${cmd}` : `local-dev ${cmd}`;

const program = new Command();

program
  .name("local-dev")
  .description("Local dev infra generator + runner")
  .option("-c, --config <path>", "config yaml path", "localdev.config.yaml");

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
 *
 * ✅ 중요한 정리:
 * - "forward"를 program에 2번 등록하면 충돌/예상치 못한 동작이 생김
 * - 그래서 forward는 한 번만 만들고,
 *   - 기본 액션: start (foreground)
 *   - subcommand: start/status/stop
 */
const forward = program
  .command("forward")
  .description("Port-forward enabled infra services");

// 기본: local-dev forward == start
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
