# TypeORM Query Analyzer

A TypeORM interceptor that monitors query performance and sends webhook notifications when queries exceed defined thresholds.

## Features

- 🚀 **Performance Monitoring**: Automatically tracks query execution times
- 📊 **Configurable Thresholds**: Set custom performance thresholds via environment variables
- 🔗 **Webhook Integration**: Send alerts to external monitoring systems
- 🔍 **Stack Trace Capture**: Optional stack trace collection for debugging
- 🌍 **Environment Aware**: Different settings for development and production
- 📝 **Comprehensive Logging**: Detailed query information in reports

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
QUERY_ANALYZER_CAPTURE_STACK=true
QUERY_ANALYZER_MAX_STACK=15
QUERY_ANALYZER_MAX_QUERY=5000
QUERY_ANALYZER_TIMEOUT_MS=10000
QUERY_ANALYZER_ENABLE_DEV=true
QUERY_ANALYZER_ENABLE_PROD=false
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
  getMaxQueryExecutionTime,
} from "typeorm-query-analyzer";

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_CONNECTION,
  entities: [
    /* your entities */
  ],
  synchronize: false,
  logging: true,
  maxQueryExecutionTime: getMaxQueryExecutionTime(), // Uses QUERY_ANALYZER_THRESHOLD_MS
  logger: new QueryAnalyzerLogger(), // Add the query analyzer
});
```

### 3. Custom Configuration

```typescript
import {
  QueryAnalyzerLogger,
  QueryAnalyzerConfig,
} from "typeorm-query-analyzer";

const customConfig = new QueryAnalyzerConfig();
const analyzer = new QueryAnalyzerLogger(customConfig);

const AppDataSource = new DataSource({
  // ... other options
  logger: analyzer,
});
```

## Configuration Options

| Environment Variable           | Default | Description                                     |
| ------------------------------ | ------- | ----------------------------------------------- |
| `QUERY_ANALYZER_THRESHOLD_MS`  | `1000`  | Query execution threshold in milliseconds       |
| `QUERY_ANALYZER_API_ENDPOINT`  | -       | **Required** Webhook endpoint URL               |
| `QUERY_ANALYZER_API_KEY`       | -       | **Required** API key for webhook authentication |
| `QUERY_ANALYZER_CAPTURE_STACK` | `true`  | Enable stack trace capture                      |
| `QUERY_ANALYZER_MAX_STACK`     | `15`    | Maximum stack trace depth                       |
| `QUERY_ANALYZER_MAX_QUERY`     | `5000`  | Maximum query length before truncation          |
| `QUERY_ANALYZER_TIMEOUT_MS`    | `10000` | Webhook request timeout                         |
| `QUERY_ANALYZER_ENABLE_DEV`    | `true`  | Enable in development environment               |
| `QUERY_ANALYZER_ENABLE_PROD`   | `false` | Enable in production environment                |
| `QUERY_ANALYZER_APP_NAME`      | -       | Optional application name                       |
| `QUERY_ANALYZER_VERSION`       | -       | Optional application version                    |

## Webhook Payload

When a slow query is detected, the following payload is sent to your webhook endpoint:

```typescript
{
  queryId: string;           // Unique query identifier
  rawQuery: string;          // SQL query (truncated if too long)
  parameters: Record<string, unknown>; // Query parameters
  executionTimeMs: number;   // Execution time in milliseconds
  stackTrace: string[];      // Stack trace (if enabled)
  timestamp: string;         // ISO timestamp
  contextType: string;       // Always "typeorm-query"
  environment: string;       // NODE_ENV value
  applicationName?: string;  // Optional app name
  version?: string;          // Optional app version
}
```

## Advanced Usage

### Custom Webhook Sender

```typescript
import { IWebhookSender, TReportPayload } from "typeorm-query-analyzer";

class CustomWebhookSender implements IWebhookSender {
  async send(payload: TReportPayload): Promise<void> {
    // Your custom implementation
    console.log("Custom webhook:", payload);
  }
}

const analyzer = new QueryAnalyzerInterceptor(
  new QueryAnalyzerConfig(),
  new CustomWebhookSender()
);
```

### Mock Mode for Testing

```typescript
import { MockWebhookSender } from "typeorm-query-analyzer";

// Uses console.log instead of HTTP requests
const analyzer = new QueryAnalyzerInterceptor(
  new QueryAnalyzerConfig(),
  new MockWebhookSender()
);
```

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
