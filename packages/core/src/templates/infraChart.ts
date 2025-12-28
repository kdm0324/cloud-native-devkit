export const INFRA_CHART_YAML_HBS = `apiVersion: v2
name: infra
version: 0.1.0
type: application

dependencies:
{{#each deps}}
  - name: {{name}}
    repository: {{repoUrl}}
    version: "{{version}}"
    condition: {{conditionKey}}.enabled
{{/each}}
`;