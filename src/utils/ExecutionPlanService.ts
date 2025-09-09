import { DataSource, DataSourceOptions, QueryRunner } from "typeorm";

export interface ExecutionPlanResult {
  databaseProvider: string;
  planFormat: {
    contentType: string;
    fileExtension: string;
    description: string;
  };
  content: string;
}

export class ExecutionPlanService {
  private analysisDataSource: DataSource | null = null;

  constructor(private dataSourceOptions: DataSourceOptions) {}

  private async getAnalysisDataSource(): Promise<DataSource> {
    if (!this.analysisDataSource || !this.analysisDataSource.isInitialized) {
      const analysisOptions: DataSourceOptions = {
        ...this.dataSourceOptions,
        logging: false,
        maxQueryExecutionTime: 5000,
        entities: [],
        synchronize: false,
        name: "analysis-connection",
      };

      this.analysisDataSource = new DataSource(analysisOptions);

      await this.analysisDataSource.initialize();
    }

    return this.analysisDataSource;
  }

  public async captureExecutionPlan(
    query: string,
    parameters?: any[]
  ): Promise<ExecutionPlanResult | null> {
    const dbType = this.dataSourceOptions.type;

    if (!this.isSqlDatabase(dbType)) {
      return null;
    }

    let queryRunner: QueryRunner | null = null;

    try {
      const analysisDataSource = await this.getAnalysisDataSource();
      queryRunner = analysisDataSource.createQueryRunner();
      await queryRunner.connect();

      let explainResult: any;

      if (dbType === "mssql") {
        explainResult = await this.captureExecutionPlanForMssql(
          queryRunner,
          query,
          parameters
        );
      } else {
        const explainQuery = this.buildExplainQuery(dbType, query);
        explainResult = await queryRunner.query(explainQuery, parameters);
      }

      return {
        databaseProvider: dbType,
        planFormat: this.getPlanFormat(dbType),
        content: this.formatExplainResult(dbType, explainResult),
      };
    } catch (error) {
      console.warn("Failed to capture execution plan:", error);
      return null;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
  }

  private isSqlDatabase(dbType: string): boolean {
    const sqlDatabases = [
      "mysql",
      "postgres",
      "mariadb",
      "sqlite",
      "mssql",
      "oracle",
    ];
    return sqlDatabases.includes(dbType);
  }

  private buildExplainQuery(dbType: string, query: string): string {
    switch (dbType) {
      case "mysql":
      case "mariadb":
        return `EXPLAIN FORMAT=JSON ${query}`;

      case "postgres":
        return `EXPLAIN (FORMAT JSON) ${query}`;

      case "sqlite":
        return `EXPLAIN QUERY PLAN ${query}`;

      case "oracle":
        return `EXPLAIN PLAN FOR ${query}`;

      default:
        return `EXPLAIN ${query}`;
    }
  }

  private getPlanFormat(dbType: string): ExecutionPlanResult["planFormat"] {
    switch (dbType) {
      case "mysql":
      case "mariadb":
      case "postgres":
        return {
          contentType: "application/json",
          fileExtension: ".json",
          description: "JSON",
        };

      case "mssql":
        return {
          contentType: "application/xml",
          fileExtension: ".xml",
          description: "XML",
        };

      case "sqlite":
      case "oracle":
      default:
        return {
          contentType: "text/plain",
          fileExtension: ".txt",
          description: "TEXT",
        };
    }
  }

  private async captureExecutionPlanForMssql(
    queryRunner: QueryRunner,
    query: string,
    parameters?: any[]
  ): Promise<any> {
    try {
      await queryRunner.query("SET SHOWPLAN_XML ON");
      const explainResult = await queryRunner.query(query, parameters);
      await queryRunner.query("SET SHOWPLAN_XML OFF");

      return explainResult;
    } catch (error) {
      await queryRunner.query("SET SHOWPLAN_XML OFF");
      throw error;
    }
  }

  private formatExplainResult(dbType: string, result: any): string {
    try {
      switch (dbType) {
        case "mysql":
        case "mariadb":
        case "postgres":
          return JSON.stringify(result, null, 2);

        case "mssql":
        case "sqlite":
        case "oracle":
        default:
          if (typeof result === "string") {
            return result;
          }
          return JSON.stringify(result, null, 2);
      }
    } catch (error) {
      return String(result);
    }
  }

  public async cleanup(): Promise<void> {
    if (this.analysisDataSource?.isInitialized) {
      await this.analysisDataSource.destroy();
      this.analysisDataSource = null;
    }
  }
}
