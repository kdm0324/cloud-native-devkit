import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node18",
  outDir: "dist-release",
  clean: true,

  // ✅ pkg는 단일 파일이 제일 안전함
  splitting: false,
  sourcemap: false,
  minify: false,

  // ✅ 핵심: ESM-only deps를 external로 두지 말고 통째로 번들에 포함
  // - execa (ESM only)
  // - @inquirer/prompts (대부분 ESM)
  // - workspace core(ESM)까지 같이 말아버리면 require 문제 원천 차단
  noExternal: ["execa", "@inquirer/prompts", "@cloud-native-devkit/core"],
});
