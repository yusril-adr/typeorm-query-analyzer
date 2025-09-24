import axios, { AxiosInstance, AxiosResponse } from "axios";
import PQueue from "p-queue";
import { TReportPayload } from "../types/TReportPayload";
import { IQueryAnalyzerConfig } from "../config/QueryAnalyzerConfig";

export interface IWebhookSender {
  send(payload: TReportPayload): Promise<void>;
}

export class WebhookSender implements IWebhookSender {
  private readonly httpClient: AxiosInstance;
  private readonly config: IQueryAnalyzerConfig;

  constructor(config: IQueryAnalyzerConfig) {
    this.config = config;
    this.httpClient = axios.create({
      timeout: config.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "User-Agent": "typeorm-query-analyzer",
        "X-Project-Id": config.projectId,
      },
    });
  }

  public async send(payload: TReportPayload): Promise<void> {
    try {
      const response: AxiosResponse = await this.httpClient.post(
        this.config.apiEndpoint,
        payload
      );

      if (response.status >= 400) {
        console.error(
          `Query analyzer webhook failed with status ${response.status}:`,
          response.statusText
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          console.error(
            `Query analyzer webhook timeout after ${this.config.timeoutMs}ms`
          );
        } else if (error.response) {
          console.error(
            `Query analyzer webhook failed with status ${error.response.status}:`,
            error.response.statusText
          );
        } else if (error.request) {
          console.error("Query analyzer webhook failed - no response received");
        } else {
          console.error("Query analyzer webhook failed:", error.message);
        }
      } else {
        console.error("Query analyzer webhook unexpected error:", error);
      }
    }
  }
}

export class QueuedWebhookSender implements IWebhookSender {
  private readonly webhookSender: WebhookSender;
  private readonly queue: PQueue;

  constructor(config: IQueryAnalyzerConfig) {
    this.webhookSender = new WebhookSender(config);

    const queueOptions: any = {
      concurrency: config.queueConcurrency,
    };

    if (config.queueIntervalCap > 0) {
      queueOptions.intervalCap = config.queueIntervalCap;
      queueOptions.interval = config.queueIntervalInMs;
    }

    this.queue = new PQueue(queueOptions);

    this.queue.on("active", () => {
      if (config.logging) {
        console.log(`[Queue] Processing webhook. Queue size: ${this.queue.size}, Pending: ${this.queue.pending}`);
      }
    });

    this.queue.on("error", (error) => {
      console.error("[Queue] Webhook queue error:", error);
    });
  }

  public async send(payload: TReportPayload): Promise<void> {
    try {
      await this.queue.add(async () => {
        await this.webhookSender.send(payload);
      });
    } catch (error) {
      console.error("[Queue] Failed to queue webhook:", error);
      try {
        await this.webhookSender.send(payload);
      } catch (fallbackError) {
        console.error("[Queue] Fallback webhook send also failed:", fallbackError);
      }
    }
  }
}

export class MockWebhookSender implements IWebhookSender {
  private readonly queue: PQueue;
  private readonly config: IQueryAnalyzerConfig;

  constructor(config: IQueryAnalyzerConfig) {
    this.config = config;
    const queueOptions: any = {
      concurrency: config.queueConcurrency,
    };

    if (config.queueIntervalCap > 0) {
      queueOptions.intervalCap = config.queueIntervalCap;
      queueOptions.interval = config.queueIntervalInMs;
    }

    this.queue = new PQueue(queueOptions);

    this.queue.on("active", () => {
      console.log(`[MOCK Queue] Processing webhook. Queue size: ${this.queue.size}, Pending: ${this.queue.pending}`);
    });

    this.queue.on("error", (error) => {
      console.error("[MOCK Queue] Webhook queue error:", error);
    });

    console.log("[MOCK] Webhook sender initialized with queue config:", {
      concurrency: config.queueConcurrency,
      intervalCap: config.queueIntervalCap,
      intervalInMs: config.queueIntervalInMs
    });
  }

  public async send(payload: TReportPayload): Promise<void> {
    try {
      await this.queue.add(async () => {
        console.log("[MOCK] Query analyzer would send:", payload);
        console.log("[MOCK] With X-Project-Id header:", this.config.projectId);
      });
    } catch (error) {
      console.error("[MOCK Queue] Failed to queue webhook:", error);
      console.log("[MOCK] Fallback - Query analyzer would send:", payload);
      console.log("[MOCK] Fallback - With X-Project-Id header:", this.config.projectId);
    }
  }
}
