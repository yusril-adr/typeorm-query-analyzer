import path from "path";
import fs from "fs";
import type { DataSourceOptions } from "typeorm";
import { QueryAnalyzerLogger } from "../interceptors/QueryAnalyzerLogger";
import {
  QueryAnalyzerConfig,
  IQueryAnalyzerConfig,
} from "../config/QueryAnalyzerConfig";
import { version } from "os";

export function createDataSourceWithAnalyzer<T extends object = {}>(
  dataSourceOptions?: DataSourceOptions & T,
  analyzerConfig?: Partial<IQueryAnalyzerConfig>
): DataSourceOptions & T {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  const configWithType = {
    ...analyzerConfig,
    applicationName: analyzerConfig?.applicationName ?? packageJson.name,
    contextType:
      analyzerConfig?.contextType ??
      `${analyzerConfig?.applicationName ?? packageJson.name}-${
        dataSourceOptions?.type ?? "unknown"
      }`,
    logging: analyzerConfig?.logging ?? false,
    version: analyzerConfig?.version ?? packageJson.version ?? "unknown",
  };
  const config = new QueryAnalyzerConfig(configWithType);
  const logger = new QueryAnalyzerLogger({ 
    config, 
    dataSourceOptions 
  });

  return {
    ...dataSourceOptions,
    logging: dataSourceOptions?.logging ?? true,
    maxQueryExecutionTime: config.thresholdMs,
    logger,
  } as DataSourceOptions & T;
}
