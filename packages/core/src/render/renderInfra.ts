import Handlebars from "handlebars";
import type { LocalDevConfig } from "../config.js";
import type { InfraSpec } from "../spec.js";
import { toRepoUrlMap } from "../config.js";
import { INFRA_CHART_YAML_HBS } from "../templates/infraChart.js";
import { INFRA_DEFAULT_VALUES_YAML_HBS } from "../templates/infraDefaultValues.js";
import { INFRA_VALUES_YAML_HBS } from "../templates/infraValues.js";

const compile = (s: string) => Handlebars.compile(s, { noEscape: true });

export const renderInfraChart = (cfg: LocalDevConfig, spec: InfraSpec) => {
  const repoMap = toRepoUrlMap(cfg);

  const deps = Object.entries(cfg.infra.components).map(([key, c]) => {
    const repoUrl = repoMap[c.chart.repoName];
    if (!repoUrl) {
      throw new Error(`repoName '${c.chart.repoName}'의 url을 config.helm.repos에서 찾을 수 없습니다.`);
    }
    return {
      name: c.chart.name,
      repoUrl,
      version: c.chart.version,
      conditionKey: key
    };
  });

  const chartYaml = compile(INFRA_CHART_YAML_HBS)({ deps });
  const defaultValuesYaml = compile(INFRA_DEFAULT_VALUES_YAML_HBS)({ components: cfg.infra.components });
  const valuesYaml = compile(INFRA_VALUES_YAML_HBS)(spec);

  return { chartYaml, defaultValuesYaml, valuesYaml };
};