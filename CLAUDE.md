# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeORM Query Analyzer is an NPM package that provides real-time performance monitoring for TypeORM databases. It intercepts database queries, detects slow queries that exceed configurable thresholds, and sends detailed diagnostic reports (including stack traces and execution plans) to external monitoring systems via webhooks.

**Key Use Case**: Help developers identify and debug slow database queries in production and development environments.

## Development Commands

### Build & Compilation

```bash
npm run build    # Compile TypeScript to dist/
npm run dev      # Watch mode for development
```

### Node Version

This project requires Node.js v22+. Use nvm to switch:

```bash
nvm use          # Uses version from .nvmrc
```

### Testing

No test suite is currently configured. The project relies on manual testing.

## Architecture Overview

### Core Flow

```
TypeORM Query Execution
    ↓
QueryAnalyzerLogger.logQuerySlow() (triggered when query exceeds threshold)
    ↓
Capture stack trace (if enabled)
    ↓
ExecutionPlanService.captureExecutionPlan() (async, separate connection)
    ↓
Database EXPLAIN query executed
    ↓
Payload created (TReportPayload)
    ↓
QueuedWebhookSender.send() (queued with rate limiting)
    ↓
HTTP POST to monitoring endpoint
```

### Key Components

#### 1. QueryAnalyzerLogger (`src/interceptors/QueryAnalyzerLogger.ts`)

The main interceptor that implements TypeORM's `Logger` interface.

**Responsibilities**:

- Intercepts `logQuerySlow()` events from TypeORM
- Captures and filters stack traces (converts absolute paths to relative)
- Sanitizes query parameters to prevent sensitive data leakage
- Truncates long queries based on `MAX_QUERY` limit
- Coordinates with ExecutionPlanService and WebhookSender

**Key Methods**:

- `handleSlowQuery()` - Creates payload and triggers webhook
- `captureStackTrace()` - Captures filtered call stack
- `sanitizeParameters()` - Safely serializes query params (objects → `[Object]`)
- `convertToRelativePath()` - Converts absolute to relative paths

#### 2. ExecutionPlanService (`src/utils/ExecutionPlanService.ts`)

Captures database execution plans (EXPLAIN queries) using isolated connections.

**Critical Pattern**: Creates a **separate "analysis-connection"** to avoid interfering with the main application's database connection. This prevents EXPLAIN queries from blocking or affecting normal query execution.

**Database-Specific EXPLAIN Syntax**:
| Database | Command | Format |
|----------|---------|--------|
| MySQL/MariaDB | `EXPLAIN FORMAT=JSON` | JSON |
| PostgreSQL | `EXPLAIN (FORMAT JSON)` | JSON |
| SQL Server | `SET SHOWPLAN_XML ON` | XML |
| SQLite | `EXPLAIN QUERY PLAN` | TEXT |
| Oracle | `EXPLAIN PLAN FOR` | TEXT |

**NoSQL Handling**: Automatically disabled for MongoDB and other NoSQL databases.

**Error Handling**: Execution plan failures are logged but don't prevent webhook delivery (graceful degradation).

#### 3. WebhookSender Implementations (`src/utils/WebhookSender.ts`)

**Three-Tier Strategy**:

1. **QueuedWebhookSender** (Production):

   - Wraps WebhookSender with p-queue for rate limiting and concurrency control
   - Non-blocking: Webhook delivery doesn't block query execution
   - Graceful fallback: Falls back to direct send if queue fails
   - Configurable via `QUEUE_CONCURRENCY`, `QUEUE_INTERVAL_CAP`, `QUEUE_INTERVAL_IN_MS`

2. **WebhookSender** (Base):

   - Direct HTTP POST via axios
   - Authorization: Bearer token in header
   - Custom headers: `X-Project-Id`, `User-Agent`
   - Timeout handling

3. **MockWebhookSender** (Development/Testing):
   - Console logging instead of HTTP requests
   - Used when configuration validation fails or for development

**Sender Selection Logic**:

- If config validation fails → MockWebhookSender
- If config valid → QueuedWebhookSender

#### 4. QueryAnalyzerConfig (`src/config/QueryAnalyzerConfig.ts`)

Centralized configuration with environment variable support.

**Configuration Priority** (highest to lowest):

1. Partial config parameter passed to constructor
2. Environment variables (from `.env`)
3. Auto-detected values (from consuming app's `package.json`)
4. Default fallbacks

**Required Configuration**:

- `QUERY_ANALYZER_API_ENDPOINT` - Webhook URL
- `QUERY_ANALYZER_API_KEY` - API key for authentication
- `QUERY_ANALYZER_PROJECT_ID` - Project identifier

#### 5. TypeOrmIntegration (`src/utils/TypeOrmIntegration.ts`)

Helper utility for easy integration with TypeORM DataSource.

**Key Features**:

- Auto-detects application name/version from `package.json`
- Generates `contextType`: `${appName}-${dbType}`
- Factory function: `createDataSourceWithAnalyzer()`
- Supports generic types for TypeORM extensions (e.g., TypeORM Seeding)

## Configuration

### Environment Variables

The package supports 22+ environment variables. Key categories:

**Core Settings**:

- `QUERY_ANALYZER_THRESHOLD_MS=1000` - Slow query threshold in milliseconds
- `QUERY_ANALYZER_API_ENDPOINT` - Required webhook URL
- `QUERY_ANALYZER_API_KEY` - Required API key
- `QUERY_ANALYZER_PROJECT_ID` - Required project identifier

**Feature Flags**:

- `QUERY_ANALYZER_ENABLE=true` - Enable the query analyzer
- `QUERY_ANALYZER_EXECUTION_PLAN_ENABLED=true` - Enable EXPLAIN query capture
- `QUERY_ANALYZER_CAPTURE_STACK=true` - Enable stack trace capture

**Queue Configuration** (for QueuedWebhookSender):

- `QUERY_ANALYZER_QUEUE_CONCURRENCY=3` - Max simultaneous webhook requests
- `QUERY_ANALYZER_QUEUE_INTERVAL_CAP=1` - Max requests per interval
- `QUERY_ANALYZER_QUEUE_INTERVAL_IN_MS=1000` - Rate limit interval in ms

**Limits**:

- `QUERY_ANALYZER_MAX_STACK=15` - Maximum stack trace depth
- `QUERY_ANALYZER_MAX_QUERY=5000` - Maximum query string length
- `QUERY_ANALYZER_TIMEOUT_MS=10000` - Webhook request timeout

See `.env.example` for full list with descriptions.

## Code Conventions

### Naming Patterns

- **Files**: PascalCase for classes (`QueryAnalyzerLogger.ts`, `WebhookSender.ts`)
- **Types**: `T` prefix (`TReportPayload`)
- **Interfaces**: `I` prefix (`IQueryAnalyzerConfig`, `IWebhookSender`)

### Parameter Sanitization

Always sanitize query parameters before sending to webhooks to prevent sensitive data leakage:

- Objects → `[Object]`
- Unparseable values → `[Unparseable]`
- Implemented in `QueryAnalyzerLogger.sanitizeParameters()`

### Path Handling

Stack traces are converted from absolute to relative paths for portability:

- Uses `process.cwd()` as base
- Filters out internal TypeORM frames
- Implemented in `QueryAnalyzerLogger.convertToRelativePath()`

### Error Handling Philosophy

1. **Never Block Main Flow**: Webhook failures don't crash the application
2. **Log Don't Throw**: Use `console.error()` instead of throwing exceptions
3. **Graceful Degradation**: Fall back to simpler implementations on failure
4. **Silent Failure for Non-Critical**: Execution plan failures are logged but don't prevent webhook delivery

## Design Patterns Used

### 1. Dual Connection Pattern

The ExecutionPlanService creates a **separate database connection** specifically for running EXPLAIN queries. This prevents analysis queries from:

- Blocking application queries
- Interfering with transaction state
- Affecting connection pool availability

### 2. Strategy Pattern

Multiple WebhookSender implementations (QueuedWebhookSender, WebhookSender, MockWebhookSender) are interchangeable via the `IWebhookSender` interface.

### 3. Factory Pattern

`createDataSourceWithAnalyzer()` constructs a fully-configured TypeORM DataSource with the QueryAnalyzerLogger pre-integrated.

### 4. Dependency Injection

QueryAnalyzerLogger accepts configuration and webhookSender via constructor, making it testable and mockable.

## TypeScript Configuration

- **Target**: ES2023
- **Module**: CommonJS (for Node.js compatibility)
- **Output**: `./dist`
- **Strict Mode**: Enabled (with some relaxations for flexibility)
- **Decorators**: Enabled (experimental, for TypeORM compatibility)
- **Source Maps**: Enabled

## Package Publishing

The `.npmignore` configuration ensures only compiled code is published:

- Includes: `dist/` directory and type definitions (`.d.ts`)
- Excludes: Source files (`.ts`), tests, development tools, configuration files
- Documentation: Only `README.md` is included

## Important Implementation Notes

### When Adding Database Support

If adding support for a new database type:

1. Update `ExecutionPlanService.getSupportedDatabaseTypes()`
2. Add database-specific EXPLAIN syntax in `captureExecutionPlan()`
3. Handle the specific output format (JSON, XML, or TEXT)
4. Consider NoSQL vs SQL differences

### When Modifying Webhook Delivery

- Always maintain non-blocking behavior (use async/await properly)
- Preserve the queue-based rate limiting to prevent overwhelming monitoring endpoints
- Maintain the fallback chain: Queue → Direct → Mock

### When Updating Configuration

- Add new environment variables to `.env.example` with descriptions
- Update `QueryAnalyzerConfig` interface and implementation
- Maintain configuration priority: parameter > env var > auto-detect > default
- Update validation logic if adding required fields

### Security Considerations

- **Parameter Sanitization**: Never send raw parameter values that might contain passwords, tokens, or PII
- **Query Truncation**: Limit query length to prevent excessively large payloads
- **Bearer Token Auth**: Always use secure authentication for webhook endpoints
- **Timeout Protection**: Maintain request timeouts to prevent hanging connections
