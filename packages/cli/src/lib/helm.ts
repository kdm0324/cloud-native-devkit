import { execa } from "execa";

export const helmRepoSync = async (repos: Array<{ name: string; url: string }>) => {
  for (const r of repos) {
    await execa("helm", ["repo", "add", r.name, r.url], { stdio: "ignore", reject: false });
  }
  await execa("helm", ["repo", "update"], { stdio: "inherit" });
};

export const helmDepUpdate = async (chartDir: string) => {
  await execa("helm", ["dependency", "update", chartDir], { stdio: "inherit" });
};

export const helmUpsert = async (release: string, chartDir: string, ns: string, valuesPath: string) => {
  await execa("helm", ["upgrade", "--install", release, chartDir, "-n", ns, "--create-namespace", "-f", valuesPath], {
    stdio: "inherit"
  });
};

export const helmUninstall = async (release: string, ns: string) => {
  await execa("helm", ["uninstall", release, "-n", ns], { stdio: "inherit", reject: false });
};