import fs from "node:fs";
import path from "node:path";
import type { LocalDevConfig } from "../config.js";
import type { InfraSpec } from "../spec.js";
import { renderInfraChart } from "./renderInfra.js";

const write = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
};

export const generateProject = (cfg: LocalDevConfig, spec: InfraSpec, outDir: string) => {
  const { chartYaml, defaultValuesYaml, valuesYaml } = renderInfraChart(cfg, spec);

  write(path.join(outDir, "charts/infra/Chart.yaml"), chartYaml);
  write(path.join(outDir, "charts/infra/values.yaml"), defaultValuesYaml);
  write(path.join(outDir, "infra-values.yaml"), valuesYaml);

  write(
    path.join(outDir, "README.generated.md"),
    `# Generated Local Dev Template

- namespace: ${spec.namespace}
- release: ${spec.release}

## Next
- cnd up
- cnd down
`
  );
};