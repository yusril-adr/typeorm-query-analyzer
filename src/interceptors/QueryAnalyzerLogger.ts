import { Logger } from "typeorm";
import { TReportPayload } from "../types/TReportPayload";
import {
  QueryAnalyzerConfig,
  IQueryAnalyzerConfig,
} from "../config/QueryAnalyzerConfig";
import {
  WebhookSender,
  IWebhookSender,
  MockWebhookSender,
} from "../utils/WebhookSender";
import { randomUUID } from "crypto";

export class QueryAnalyzerLogger implements Logger {
  private readonly config: IQueryAnalyzerConfig;
  private readonly webhookSender: IWebhookSender;
  private readonly queryTimestamps: Map<string, number> = new Map();

  constructor(config?: IQueryAnalyzerConfig, webhookSender?: IWebhookSender) {
    this.config = config || new QueryAnalyzerConfig();

    try {
      this.config.validate();
      this.webhookSender = webhookSender || new WebhookSender(this.config);
    } catch (error) {
      console.warn(
        "Query analyzer validation failed, using mock sender:",
        error
      );
      this.webhookSender = new MockWebhookSender();
    }
  }

  logQuery(query: string, parameters?: any[]): void {
    if (!this.config.isEnabled()) return;

    const queryId = this.generateQueryId();
    this.queryTimestamps.set(queryId, Date.now());

    console.log("Executing query:", query, parameters || []);

    setTimeout(() => {
      this.queryTimestamps.delete(queryId);
    }, 60000);
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: any[]
  ): void {
    if (!this.config.isEnabled()) return;

    console.error("Query error:", error);
  }

  logQuerySlow(time: number, query: string, parameters?: any[]): void {
    console.warn(`Slow query detected: ${time} ms`, query, parameters || []);
    console.log(this.config);
    if (!this.config.isEnabled() || time < this.config.thresholdMs) return;

    this.handleSlowQuery(time, query, parameters);
  }

  logSchemaBuild(message: string): void {
    // Not relevant for query performance monitoring
  }

  logMigration(message: string): void {
    // Not relevant for query performance monitoring
  }

  log(level: "log" | "info" | "warn", message: any): void {
    if (level === "warn") {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  private async handleSlowQuery(
    executionTimeMs: number,
    query: string,
    parameters?: any[]
  ): Promise<void> {
    console.warn(
      `Slow query detected (${executionTimeMs} ms):`,
      query,
      parameters || []
    );
    try {
      const payload = this.createReportPayload(
        executionTimeMs,
        query,
        parameters
      );
      await this.webhookSender.send(payload);
    } catch (error) {
      console.error("Failed to send query analysis report:", error);
    }
  }

  private createReportPayload(
    executionTimeMs: number,
    query: string,
    parameters?: any[]
  ): TReportPayload {
    const stackTrace = this.config.captureStack ? this.captureStackTrace() : [];
    const truncatedQuery = this.truncateQuery(query);
    const safeParameters = this.sanitizeParameters(parameters);

    return {
      queryId: this.generateQueryId(),
      rawQuery: truncatedQuery,
      parameters: safeParameters,
      executionTimeMs,
      stackTrace,
      timestamp: new Date().toISOString(),
      contextType: "typeorm-query",
      environment: process.env.NODE_ENV || "unknown",
      applicationName: this.config.applicationName,
      version: this.config.version,
    };
  }

  private captureStackTrace(): string[] {
    const stack = new Error().stack;
    if (!stack) return [];

    const lines = stack.split("\n");
    const relevantLines = lines
      .slice(1)
      .filter((line) => !line.includes("QueryAnalyzerInterceptor"))
      .filter((line) => !line.includes("node_modules/typeorm"))
      .slice(0, this.config.maxStack);

    return relevantLines.map((line) => line.trim());
  }

  private truncateQuery(query: string): string {
    if (query.length <= this.config.maxQuery) {
      return query;
    }

    return query.substring(0, this.config.maxQuery) + "... [TRUNCATED]";
  }

  private sanitizeParameters(parameters?: any[]): Record<string, unknown> {
    if (!parameters || !Array.isArray(parameters)) {
      return {};
    }

    const sanitized: Record<string, unknown> = {};

    parameters.forEach((param, index) => {
      try {
        if (param === null || param === undefined) {
          sanitized[`param_${index}`] = param;
        } else if (
          typeof param === "string" ||
          typeof param === "number" ||
          typeof param === "boolean"
        ) {
          sanitized[`param_${index}`] = param;
        } else if (param instanceof Date) {
          sanitized[`param_${index}`] = param.toISOString();
        } else if (typeof param === "object") {
          sanitized[`param_${index}`] = "[Object]";
        } else {
          sanitized[`param_${index}`] = String(param);
        }
      } catch (error) {
        sanitized[`param_${index}`] = "[Unparseable]";
      }
    });

    return sanitized;
  }

  private generateQueryId(): string {
    return randomUUID();
  }
}
