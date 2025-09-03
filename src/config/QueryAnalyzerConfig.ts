export interface IQueryAnalyzerConfig {
  thresholdMs: number;
  apiEndpoint: string;
  apiKey: string;
  captureStack: boolean;
  maxStack: number;
  maxQuery: number;
  timeoutMs: number;
  enableDev: boolean;
  enableProd: boolean;
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
  public readonly enableDev: boolean;
  public readonly enableProd: boolean;
  public readonly applicationName?: string;
  public readonly version?: string;

  constructor() {
    this.thresholdMs = parseInt(process.env.QUERY_ANALYZER_THRESHOLD_MS || '1000', 10);
    this.apiEndpoint = process.env.QUERY_ANALYZER_API_ENDPOINT || '';
    this.apiKey = process.env.QUERY_ANALYZER_API_KEY || '';
    this.captureStack = process.env.QUERY_ANALYZER_CAPTURE_STACK === 'true';
    this.maxStack = parseInt(process.env.QUERY_ANALYZER_MAX_STACK || '15', 10);
    this.maxQuery = parseInt(process.env.QUERY_ANALYZER_MAX_QUERY || '5000', 10);
    this.timeoutMs = parseInt(process.env.QUERY_ANALYZER_TIMEOUT_MS || '10000', 10);
    this.enableDev = process.env.QUERY_ANALYZER_ENABLE_DEV === 'true';
    this.enableProd = process.env.QUERY_ANALYZER_ENABLE_PROD === 'true';
    this.applicationName = process.env.QUERY_ANALYZER_APP_NAME;
    this.version = process.env.QUERY_ANALYZER_VERSION;
  }

  public isEnabled(): boolean {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    if (isDevelopment && this.enableDev) return true;
    if (isProduction && this.enableProd) return true;
    if (!isDevelopment && !isProduction && this.enableDev) return true;

    return false;
  }

  public validate(): void {
    if (!this.apiEndpoint) {
      throw new Error('QUERY_ANALYZER_API_ENDPOINT is required');
    }

    if (!this.apiKey) {
      throw new Error('QUERY_ANALYZER_API_KEY is required');
    }

    if (this.thresholdMs <= 0) {
      throw new Error('QUERY_ANALYZER_THRESHOLD_MS must be greater than 0');
    }

    if (this.maxStack <= 0) {
      throw new Error('QUERY_ANALYZER_MAX_STACK must be greater than 0');
    }

    if (this.maxQuery <= 0) {
      throw new Error('QUERY_ANALYZER_MAX_QUERY must be greater than 0');
    }

    if (this.timeoutMs <= 0) {
      throw new Error('QUERY_ANALYZER_TIMEOUT_MS must be greater than 0');
    }
  }
}