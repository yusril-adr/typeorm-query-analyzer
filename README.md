# TypeORM Query Analyzer

A TypeORM interceptor that monitors query performance and sends webhook notifications when queries exceed defined thresholds.

## Features

- 🚀 **Performance Monitoring**: Automatically tracks query execution times
- 📊 **Configurable Thresholds**: Set custom performance thresholds via environment variables
- 🔗 **Webhook Integration**: Send alerts to external monitoring systems
- 🔍 **Stack Trace Capture**: Optional stack trace collection for debugging
- 🌍 **Environment Aware**: Different settings for development and production
- 📝 **Comprehensive Logging**: Detailed query information in reports
- 📈 **Execution Plan Capture**: Automatic EXPLAIN query execution for SQL databases

## Installation

```bash
npm install typeorm-query-analyzer
```

## Quick Start

### 1. Environment Configuration

Create a `.env` file with the following variables:

```env
# Database
DB_CONNECTION=postgres://user:pass@localhost:5432/myapp

# Query Analyzer
QUERY_ANALYZER_THRESHOLD_MS=1000
QUERY_ANALYZER_API_ENDPOINT=https://monitoring.mycompany.com/api/slow-queries
QUERY_ANALYZER_API_KEY=sk-1234567890abcdef
QUERY_ANALYZER_PROJECT_ID=my-project-id
QUERY_ANALYZER_CAPTURE_STACK=true
QUERY_ANALYZER_MAX_STACK=15
QUERY_ANALYZER_MAX_QUERY=5000
QUERY_ANALYZER_TIMEOUT_MS=10000
QUERY_ANALYZER_ENABLE_DEV=true
QUERY_ANALYZER_ENABLE_PROD=false

# Execution Plan Capture (Optional)
QUERY_ANALYZER_EXECUTION_PLAN_ENABLED=true
```

### 2. TypeORM Integration

#### Option A: Using the Helper Function (Recommended)

```typescript
import { DataSource } from "typeorm";
import { createDataSourceWithAnalyzer } from "typeorm-query-analyzer";

const dataSourceConfig = createDataSourceWithAnalyzer({
  type: "postgres",
  url: process.env.DB_CONNECTION,
  entities: [
    /* your entities */
  ],
  synchronize: false,
});

const AppDataSource = new DataSource(dataSourceConfig);
// Automatically sets maxQueryExecutionTime and logger from QUERY_ANALYZER_THRESHOLD_MS
```

Or with extended types (e.g., with TypeORM Seeding):

```typescript
import { DataSource } from "typeorm";
import { SeederOptions } from "typeorm-extension";
import { createDataSourceWithAnalyzer } from "typeorm-query-analyzer";

const databaseConfig = createDataSourceWithAnalyzer<SeederOptions>({
  type: "postgres",
  url: process.env.DB_CONNECTION,
  entities: [
    /* your entities */
  ],
  seeds: [
    /* your seeds */
  ],
  synchronize: false,
});

const AppDataSource = new DataSource(databaseConfig);
```

#### Option B: Manual Setup

```typescript
import { DataSource } from "typeorm";
import {
  QueryAnalyzerLogger,
  QueryAnalyzerConfig,
} from "typeorm-query-analyzer";

const config = new QueryAnalyzerConfig();
const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_CONNECTION,
  entities: [
    /* your entities */
  ],
  synchronize: false,
  logging: true,
  maxQueryExecutionTime: config.thresholdMs, // Uses QUERY_ANALYZER_THRESHOLD_MS
  logger: new QueryAnalyzerLogger(config),
});
```

### 3. Custom Configuration

#### Using Partial Configuration Override

```typescript
import { DataSource } from "typeorm";
import { createDataSourceWithAnalyzer } from "typeorm-query-analyzer";

const databaseConfig = createDataSourceWithAnalyzer(
  {
    type: "postgres",
    url: process.env.DB_CONNECTION,
    entities: [
      /* your entities */
    ],
    synchronize: false,
  },
  {
    // Override specific analyzer settings
    thresholdMs: 500, // Custom threshold (overrides env var)
    contextType: "my-custom-context",
    enableDev: true,
    captureStack: false,
  }
);

const AppDataSource = new DataSource(databaseConfig);
```

#### Manual Configuration

```typescript
import {
  DataSource,
  QueryAnalyzerLogger,
  QueryAnalyzerConfig,
} from "typeorm-query-analyzer";

const customConfig = new QueryAnalyzerConfig({
  thresholdMs: 2000,
  apiEndpoint: "https://custom-endpoint.com/webhooks",
  apiKey: "custom-key",
  enableDev: true,
  captureStack: true,
  contextType: "my-app-production",
});

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_CONNECTION,
  entities: [
    /* your entities */
  ],
  maxQueryExecutionTime: customConfig.thresholdMs,
  logger: new QueryAnalyzerLogger(customConfig),
});
```

## Configuration Options

### Environment Variables

| Variable                       | Default | Description                                     |
| ------------------------------ | ------- | ----------------------------------------------- |
| `QUERY_ANALYZER_THRESHOLD_MS`  | `1000`  | Query execution threshold in milliseconds       |
| `QUERY_ANALYZER_API_ENDPOINT`  | -       | **Required** Webhook endpoint URL               |
| `QUERY_ANALYZER_API_KEY`       | -       | **Required** API key for webhook authentication |
| `QUERY_ANALYZER_PROJECT_ID`    | -       | **Required** Project identifier for analytics   |
| `QUERY_ANALYZER_CAPTURE_STACK` | `false` | Enable stack trace capture                      |
| `QUERY_ANALYZER_MAX_STACK`     | `15`    | Maximum stack trace depth                       |
| `QUERY_ANALYZER_MAX_QUERY`     | `5000`  | Maximum query length before truncation          |
| `QUERY_ANALYZER_TIMEOUT_MS`               | `10000` | Webhook request timeout                         |
| `QUERY_ANALYZER_ENABLE_DEV`               | `false` | Enable in development environment               |
| `QUERY_ANALYZER_ENABLE_PROD`              | `false` | Enable in production environment                |
| `QUERY_ANALYZER_EXECUTION_PLAN_ENABLED`   | `false` | Enable execution plan capture for SQL databases |
| `QUERY_ANALYZER_QUEUE_CONCURRENCY`        | `3`     | Maximum simultaneous webhook requests           |
| `QUERY_ANALYZER_QUEUE_INTERVAL_CAP`       | `1`     | Max requests per interval (1 = rate limited)    |
| `QUERY_ANALYZER_QUEUE_INTERVAL_IN_MS`     | `1000`  | Rate limiting interval in milliseconds          |
| `NODE_ENV` or `APP_ENV`                   | -       | Environment detection (development/production)  |

### Automatic Configuration

| Property          | Source                                          | Description                          |
| ----------------- | ----------------------------------------------- | ------------------------------------ |
| `applicationName` | `package.json` name field                       | Auto-detected from consuming project |
| `version`         | `package.json` version field                    | Auto-detected from consuming project |
| `contextType`     | `${applicationName}-${databaseType}`            | Generated context identifier         |
| `logging`         | `false` (analyzer config) / `true` (DataSource) | Separate logging controls            |

### Configuration Priority

1. **Partial config parameter** (highest priority)
2. **Environment variables**
3. **Auto-detected values** (package.json)
4. **Default fallbacks** (lowest priority)

## Webhook Queuing and Rate Limiting

The analyzer uses an intelligent queuing system to ensure reliable webhook delivery without overwhelming your monitoring endpoints.

### Key Features
- **Non-blocking**: Webhook delivery doesn't block query execution
- **Concurrency control**: Limits simultaneous requests to prevent resource exhaustion
- **Rate limiting**: Respects API rate limits to prevent being blocked
- **Graceful fallback**: Falls back to direct sending if queue fails

### Configuration

#### **CONCURRENCY vs RATE LIMITING**

- **`QUERY_ANALYZER_QUEUE_CONCURRENCY`**: Maximum **simultaneous** webhook requests
  - **Purpose**: Prevents overwhelming your system resources (CPU, memory, connections)
  - **Example**: `3` means maximum 3 webhook HTTP requests happening at the same time

- **`QUERY_ANALYZER_QUEUE_INTERVAL_CAP`**: Maximum requests that can **start** within a time window
  - **Purpose**: Respects external API rate limits
  - **Example**: `10` with `QUERY_ANALYZER_QUEUE_INTERVAL_IN_MS=1000` means maximum 10 webhooks per second

#### **Common Configurations**

```env
# Basic setup (rate limited to 1 request per second)
QUERY_ANALYZER_QUEUE_CONCURRENCY=3
QUERY_ANALYZER_QUEUE_INTERVAL_CAP=1      # 1 request per second

# With rate limiting (e.g., API allows 50 requests/minute)
QUERY_ANALYZER_QUEUE_CONCURRENCY=2
QUERY_ANALYZER_QUEUE_INTERVAL_CAP=50
QUERY_ANALYZER_QUEUE_INTERVAL_IN_MS=60000

# High-volume setup (API allows 100 requests/second)
QUERY_ANALYZER_QUEUE_CONCURRENCY=5
QUERY_ANALYZER_QUEUE_INTERVAL_CAP=100
QUERY_ANALYZER_QUEUE_INTERVAL_IN_MS=1000
```

## Webhook Payload

When a slow query is detected, the following payload is sent to your webhook endpoint:

```typescript
{
  queryId: string;           // Unique query identifier (UUID)
  rawQuery: string;          // SQL query (truncated if too long)
  parameters: Record<string, unknown>; // Sanitized query parameters
  executionTimeMs: number;   // Execution time in milliseconds
  stackTrace: string[];      // Stack trace (if captureStack enabled)
  timestamp: string;         // ISO timestamp
  contextType: string;       // Format: "${applicationName}-${databaseType}"
  environment: string;       // NODE_ENV or APP_ENV value
  applicationName?: string;  // Auto-detected from package.json
  version?: string;          // Version from config or package.json
  executionPlan: {           // Query execution plan (if enabled)
    databaseProvider: string;  // Database type (mysql, postgres, etc.)
    planFormat: {
      contentType: string;     // MIME type (application/json, application/xml, text/plain)
      fileExtension: string;   // File extension (.json, .xml, .txt)
      description: string;     // Format description (JSON, XML, TEXT)
    };
    content: string;           // Raw execution plan data as string
  };
}
```

### Request Headers

All webhook requests include the following headers:

| Header | Description | Source |
|--------|-------------|--------|
| `Content-Type` | `application/json` | Automatic |
| `Authorization` | `Bearer ${QUERY_ANALYZER_API_KEY}` | Environment variable |
| `User-Agent` | `typeorm-query-analyzer` | Automatic |
| `X-Project-Id` | Project identifier | `QUERY_ANALYZER_PROJECT_ID` environment variable |

### Example Payload

```json
{
  "queryId": "123e4567-e89b-12d3-a456-426614174000",
  "rawQuery": "SELECT * FROM users WHERE email = $1 AND status = $2",
  "parameters": {
    "param_0": "user@example.com",
    "param_1": "active"
  },
  "executionTimeMs": 1500,
  "stackTrace": [
    "at UserRepository.findByEmail (/app/src/repositories/UserRepository.ts:45:12)",
    "at UserService.authenticate (/app/src/services/UserService.ts:23:8)"
  ],
  "timestamp": "2024-01-15T14:30:45.123Z",
  "contextType": "my-api-postgres",
  "environment": "production",
  "applicationName": "my-api",
  "version": "1.2.3",
  "executionPlan": {
    "databaseProvider": "postgres",
    "planFormat": {
      "contentType": "application/json",
      "fileExtension": ".json",
      "description": "JSON"
    },
    "content": "[\n  {\n    \"Plan\": {\n      \"Node Type\": \"Seq Scan\",\n      \"Relation Name\": \"users\",\n      \"Startup Cost\": 0.00,\n      \"Total Cost\": 25.50,\n      \"Plan Rows\": 1,\n      \"Plan Width\": 244\n    }\n  }\n]"
  }
}
```

## Execution Plan Capture

### Supported Databases

The execution plan capture feature works with SQL databases and automatically adapts the format based on the database type:

| Database | EXPLAIN Command | Output Format | Content Type |
|----------|----------------|---------------|--------------|
| **MySQL** | `EXPLAIN FORMAT=JSON` | JSON | `application/json` |
| **MariaDB** | `EXPLAIN FORMAT=JSON` | JSON | `application/json` |
| **PostgreSQL** | `EXPLAIN (FORMAT JSON)` | JSON | `application/json` |
| **SQLite** | `EXPLAIN QUERY PLAN` | Text | `text/plain` |
| **SQL Server** | `SET SHOWPLAN_XML ON` | XML | `application/xml` |
| **Oracle** | `EXPLAIN PLAN FOR` | Text | `text/plain` |

### NoSQL Databases

Execution plan capture is automatically **disabled** for NoSQL databases (MongoDB, etc.) as they don't support SQL EXPLAIN queries.

### Configuration

Enable execution plan capture by setting the environment variable:

```env
QUERY_ANALYZER_EXECUTION_PLAN_ENABLED=true
```

When enabled:
- A separate database connection is created for EXPLAIN queries
- EXPLAIN queries are executed using the same parameters as the original query
- Execution plans are captured **before** sending webhook notifications
- If EXPLAIN fails, the webhook is still sent without the execution plan
- The feature gracefully falls back for unsupported database types

### Performance Considerations

- Execution plan capture uses a dedicated connection pool (minimal overhead)
- EXPLAIN queries typically execute quickly but add slight latency
- The feature only activates for slow queries that exceed the threshold
- Failed EXPLAIN queries don't prevent webhook delivery

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run dev
```

## License

MIT - see [LICENSE](LICENSE) file for details.
