export const INFRA_DEFAULT_VALUES_YAML_HBS = `{{#each components}}
{{@key}}:
  enabled: false
{{/each}}
`;