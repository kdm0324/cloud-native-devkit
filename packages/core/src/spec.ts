export type InfraComponentKey = "redis" | "kafka" | "mysql" | "postgresql" | "mongodb";

export type InfraSpec = {
  namespace: string;
  release: string;
  components: Record<InfraComponentKey, { enabled: boolean }>;
  credentials: {
    mysqlRootPassword?: string;
    postgresPassword?: string;
  };
};