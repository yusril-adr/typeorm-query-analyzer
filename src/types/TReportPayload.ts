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
  executionPlan: {
    databaseProvider: string;
    planFormat: {
      contentType: string; // ex. "application/xml",
      fileExtension: string; // ex. ".xml",
      description: string; // ex. "XML",
    };
    content: string;
  };
};
