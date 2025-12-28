export const INFRA_VALUES_YAML_HBS = `redis:
  enabled: {{components.redis.enabled}}
  architecture: standalone
  auth:
    enabled: false
  master:
    persistence:
      enabled: false

kafka:
  enabled: {{components.kafka.enabled}}
  kraft:
    enabled: true
  zookeeper:
    enabled: false
  controller:
    replicaCount: 1
    persistence:
      enabled: false
  broker:
    replicaCount: 1
    persistence:
      enabled: false
  auth:
    clientProtocol: plaintext
    interBrokerProtocol: plaintext
    sasl:
      enabled: false
    tls:
      enabled: false
  configurationOverrides:
    "offsets.topic.replication.factor": "1"
    "transaction.state.log.replication.factor": "1"
    "transaction.state.log.min.isr": "1"
    "auto.create.topics.enable": "true"

mysql:
  enabled: {{components.mysql.enabled}}
  auth:
    rootPassword: "{{credentials.mysqlRootPassword}}"
  primary:
    persistence:
      enabled: false

postgresql:
  enabled: {{components.postgresql.enabled}}
  auth:
    postgresPassword: "{{credentials.postgresPassword}}"
  primary:
    persistence:
      enabled: false

mongodb:
  enabled: {{components.mongodb.enabled}}
  architecture: standalone
  auth:
    enabled: false
  persistence:
    enabled: false
`;