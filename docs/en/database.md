# Database

Due to the complexity of SQL, various SQL databases have significant differences, and more complex SQL statements are often incompatible. We default to only considering successful operation on PostgreSQL, and we may even require PostgreSQL to install specific extensions (such as TimeScale DB).

## Core Components

### [@yuants/postgres-storage](apps/postgres-storage)

This is a PostgreSQL storage service. It connects PostgreSQL database instances to the host service while hiding the login credentials required to connect to PostgreSQL.

### [@yuants/sql](./packages/@yuants-sql.md)

Client-side SQL library that provides convenient capabilities for reading and writing data to PostgreSQL in the host.

### [@yuants/tool-sql-migration](./packages/@yuants-tool-sql-migration.md)

This is a tool for managing SQL database schema migrations. It helps you create and apply database migration scripts to ensure the database schema stays synchronized with the application code.

## Database Requirements

- **PostgreSQL**: As the primary relational database
- **TimeScaleDB**: Time series database extension for efficient storage of time series data
- **Connection URI**: Configure database connection through the `POSTGRES_URI` environment variable

## Data Storage Features

- Supports optimized storage for time series data
- Provides data migration and version management
- Hides database connection details
- Provides convenient SQL operation interfaces

## Usage Recommendations

- Recommended to use Docker for TimeScaleDB deployment
- Regularly backup important data
- Use SQL migration tools to manage database schema changes

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
