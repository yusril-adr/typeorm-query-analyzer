import { Logger, DataSourceOptions } from "typeorm";
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
import {
  ExecutionPlanService,
  ExecutionPlanResult,
} from "../utils/ExecutionPlanService";
import { v4 as uuidV4 } from "uuid";
import * as path from "path";

export interface QueryAnalyzerLoggerOptions {
  config?: IQueryAnalyzerConfig;
  webhookSender?: IWebhookSender;
  dataSourceOptions?: DataSourceOptions;
}

export class QueryAnalyzerLogger implements Logger {
  private readonly config: IQueryAnalyzerConfig;
  private readonly webhookSender: IWebhookSender;
  private readonly queryTimestamps: Map<string, number> = new Map();
  private readonly executionPlanService: ExecutionPlanService | null;

  constructor(options: QueryAnalyzerLoggerOptions = {}) {
    this.config = options.config || new QueryAnalyzerConfig();

    try {
      this.config.validate();
      this.webhookSender =
        options.webhookSender || new WebhookSender(this.config);
    } catch (error) {
      console.warn(
        "Query analyzer validation failed, using mock sender:",
        error
      );
      this.webhookSender = new MockWebhookSender();
    }

    if (options.dataSourceOptions && this.config.executionPlanEnabled) {
      this.executionPlanService = new ExecutionPlanService(
        options.dataSourceOptions
      );
    } else {
      this.executionPlanService = null;
    }
  }

  logQuery(query: string, parameters?: any[]): void {
    if (!this.config.isEnabled()) return;

    const queryId = uuidV4();
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
    try {
      const payload = await this.createReportPayload(
        executionTimeMs,
        query,
        parameters
      );
      console.log("Reporting slow query:", {
        queryId: payload.queryId,
        rawQuery: payload.rawQuery,
        parameters: payload.parameters,
        executionTimeMs: payload.executionTimeMs,
      });
      await this.webhookSender.send(payload);
    } catch (error) {
      console.error("Failed to send query analysis report:", error);
    }
  }

  private async createReportPayload(
    executionTimeMs: number,
    query: string,
    parameters?: any[]
  ): Promise<TReportPayload> {
    const stackTrace = this.config.captureStack ? this.captureStackTrace() : [];
    const truncatedQuery = this.truncateQuery(query);
    const safeParameters = this.sanitizeParameters(parameters);

    let executionPlan: ExecutionPlanResult | null = null;
    if (this.executionPlanService) {
      try {
        executionPlan = await this.executionPlanService.captureExecutionPlan(
          query,
          parameters
        );
      } catch (error) {
        console.warn("Failed to capture execution plan:", error);
      }
    }

    const defaultExecutionPlan = {
      databaseProvider: "unknown",
      planFormat: {
        contentType: "text/plain",
        fileExtension: ".txt",
        description: "TEXT",
      },
      content: "",
    };

    return {
      queryId: uuidV4(),
      rawQuery: truncatedQuery,
      parameters: safeParameters,
      executionTimeMs,
      stackTrace,
      timestamp: new Date().toISOString(),
      contextType: this.config.contextType,
      environment: process.env.NODE_ENV ?? process.env.APP_ENV ?? "unknown",
      applicationName: this.config.applicationName,
      version: this.config.version,
      executionPlan: executionPlan || defaultExecutionPlan,
    };
  }

  private captureStackTrace(): string[] {
    const stack = new Error().stack;
    if (!stack) return [];

    const lines = stack.split("\n");
    const filteredLines: string[] = [];
    let foundProcessTicks = false;
    let startCapturing = false;

    for (const line of lines.slice(1)) {
      // Skip the first line (Error message)
      // Skip analyzer internal frames
      if (
        line.includes("QueryAnalyzerLogger") ||
        line.includes("QueryAnalyzerInterceptor") ||
        line.includes("node_modules/typeorm")
      ) {
        continue;
      }

      // Check if we hit process.processTicksAndRejections
      if (line.includes("process.processTicksAndRejections")) {
        foundProcessTicks = true;
        startCapturing = true;
        continue;
      }

      // Start capturing after process.processTicksAndRejections
      if (startCapturing || !foundProcessTicks) {
        // Skip Node.js internal frames (except when they're part of the user's stack)
        if (line.includes("node:internal/") && !startCapturing) {
          continue;
        }

        filteredLines.push(line.trim());

        // Stop if we've reached the max stack size
        if (filteredLines.length >= this.config.maxStack) {
          break;
        }
      }
    }

    return filteredLines.map((line) => this.convertToRelativePath(line));
  }

  private convertToRelativePath(stackLine: string): string {
    // Match file paths in stack trace - looking for absolute paths with line:column
    // Format: "at SomeFunction (/absolute/path/file.ts:123:45)"
    const match = stackLine.match(
      /^(\s*at\s+[^(]*\s*\()([^:]+):(\d+):(\d+)(\))$/
    );

    if (!match) {
      // Try simpler format: "at /absolute/path/file.ts:123:45"
      const simpleMatch = stackLine.match(/^(\s*at\s+)([^:]+):(\d+):(\d+)$/);
      if (!simpleMatch) return stackLine;

      const [, prefix, filePath, lineNum, colNum] = simpleMatch;
      return `${prefix}${this.getRelativePathSafe(
        filePath
      )}:${lineNum}:${colNum}`;
    }

    const [, prefix, filePath, lineNum, colNum, suffix] = match;
    const relativePath = this.getRelativePathSafe(filePath);

    return `${prefix}${relativePath}:${lineNum}:${colNum}${suffix}`;
  }

  private getRelativePathSafe(filePath: string): string {
    try {
      const cwd = process.cwd();
      const relativePath = path.relative(cwd, filePath);

      // If the relative path goes up directories (starts with ..), use original path
      // Otherwise use the relative path
      return relativePath && !relativePath.startsWith("..")
        ? relativePath
        : filePath;
    } catch (error) {
      // If path resolution fails, return original path
      return filePath;
    }
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
}
