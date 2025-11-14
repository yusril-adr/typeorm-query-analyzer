export interface IQueryAnalyzerConfig {
  thresholdMs: number;
  apiEndpoint: string;
  apiKey: string;
  captureStack: boolean;
  maxStack: number;
  maxQuery: number;
  timeoutMs: number;
  enabled: boolean;
  contextType: string;
  logging: boolean;
  executionPlanEnabled: boolean;
  projectId: string;
  queueConcurrency: number;
  queueIntervalCap: number;
  queueIntervalInMs: number;
  applicationName?: string;
  version?: string;
  isEnabled(): boolean;
  validate(): void;
}

export class QueryAnalyzerConfig implements IQueryAnalyzerConfig {
  public readonly thresholdMs: number;
  public readonly apiEndpoint: string;
  public readonly apiKey: string;
  public readonly captureStack: boolean;
  public readonly maxStack: number;
  public readonly maxQuery: number;
  public readonly timeoutMs: number;
  public readonly enabled: boolean;
  public readonly contextType: string;
  public readonly logging: boolean;
  public readonly executionPlanEnabled: boolean;
  public readonly projectId: string;
  public readonly queueConcurrency: number;
  public readonly queueIntervalCap: number;
  public readonly queueIntervalInMs: number;
  public readonly applicationName?: string;
  public readonly version?: string;

  constructor(partialConfig?: Partial<IQueryAnalyzerConfig>) {
    this.thresholdMs =
      partialConfig?.thresholdMs ??
      parseInt(process.env.QUERY_ANALYZER_THRESHOLD_MS || "1000", 10);
    this.apiEndpoint =
      partialConfig?.apiEndpoint ??
      (process.env.QUERY_ANALYZER_API_ENDPOINT || "");
    this.apiKey =
      partialConfig?.apiKey ?? (process.env.QUERY_ANALYZER_API_KEY || "");
    this.captureStack =
      partialConfig?.captureStack ??
      process.env.QUERY_ANALYZER_CAPTURE_STACK === "true";
    this.maxStack =
      partialConfig?.maxStack ??
      parseInt(process.env.QUERY_ANALYZER_MAX_STACK || "15", 10);
    this.maxQuery =
      partialConfig?.maxQuery ??
      parseInt(process.env.QUERY_ANALYZER_MAX_QUERY || "5000", 10);
    this.timeoutMs =
      partialConfig?.timeoutMs ??
      parseInt(process.env.QUERY_ANALYZER_TIMEOUT_MS || "10000", 10);
    this.enabled =
      partialConfig?.enabled ??
      process.env.QUERY_ANALYZER_ENABLE === "true";
    this.executionPlanEnabled =
      partialConfig?.executionPlanEnabled ??
      process.env.QUERY_ANALYZER_EXECUTION_PLAN_ENABLED === "true";
    this.projectId =
      partialConfig?.projectId ?? (process.env.QUERY_ANALYZER_PROJECT_ID || "");
    this.queueConcurrency =
      partialConfig?.queueConcurrency ??
      parseInt(process.env.QUERY_ANALYZER_QUEUE_CONCURRENCY || "3", 10);
    this.queueIntervalCap =
      partialConfig?.queueIntervalCap ??
      parseInt(process.env.QUERY_ANALYZER_QUEUE_INTERVAL_CAP || "1", 10);
    this.queueIntervalInMs =
      partialConfig?.queueIntervalInMs ??
      parseInt(process.env.QUERY_ANALYZER_QUEUE_INTERVAL_IN_MS || "1000", 10);
    this.logging = partialConfig?.logging ?? false;
    this.applicationName = partialConfig?.applicationName;
    this.contextType = partialConfig?.contextType ?? `${this.applicationName}`;
    this.version = partialConfig?.version;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public validate(): void {
    if (!this.enabled) {
      return;
    }

    if (!this.apiEndpoint) {
      throw new Error("QUERY_ANALYZER_API_ENDPOINT is required");
    }

    if (!this.apiKey) {
      throw new Error("QUERY_ANALYZER_API_KEY is required");
    }

    if (!this.projectId) {
      throw new Error("QUERY_ANALYZER_PROJECT_ID is required");
    }

    if (this.thresholdMs <= 0) {
      throw new Error("QUERY_ANALYZER_THRESHOLD_MS must be greater than 0");
    }

    if (this.maxStack <= 0) {
      throw new Error("QUERY_ANALYZER_MAX_STACK must be greater than 0");
    }

    if (this.maxQuery <= 0) {
      throw new Error("QUERY_ANALYZER_MAX_QUERY must be greater than 0");
    }

    if (this.timeoutMs <= 0) {
      throw new Error("QUERY_ANALYZER_TIMEOUT_MS must be greater than 0");
    }
  }
}
