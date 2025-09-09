import axios, { AxiosInstance, AxiosResponse } from "axios";
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

export class MockWebhookSender implements IWebhookSender {
  public async send(payload: TReportPayload): Promise<void> {
    console.log("[MOCK] Query analyzer would send:", payload);
  }
}
