export type TReportPayload = {
  queryId: string;
  rawQuery: string;
  parameters: Record<string, unknown>;
  executionTimeMs: number;
  stackTrace: string[];
  timestamp: string;
  contextType: string;
  environment: string;
  applicationName?: string;
  version?: string;
};
