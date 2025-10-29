# Data Collection

For relatively static data, we can obtain data through data provider APIs and store it in the database.

For data with time series attributes, we need to periodically collect data from data providers and store it in the database.

## Core Components

### [@yuants/data-series](libraries/data-series)

This is a general time series data model. It defines the basic attributes and methods for time series data. Data service providers can use it to create their own time series data models and quickly complete data collection tasks.

### [@yuants/series-collector](apps/series-collector)

This is a general time series data collector that uses CronJob scheduled tasks to collect data from different data providers and store it in the database. You only need to add a record in the `series_collecting_task` table in the database, and the collector will periodically collect data and store it in the database.

## Data Collection Process

1. **Task Configuration**: Configure collection tasks in the `series_collecting_task` table
2. **Scheduled Trigger**: Collector executes periodically according to CronJob configuration
3. **Data Acquisition**: Fetch data from data provider APIs
4. **Data Storage**: Store the acquired data in the database
5. **Status Monitoring**: Monitor the execution status of collection tasks

## Time Series Data Constraints

We define constraints that time series should satisfy to ensure data integrity and consistency:

- Timestamp uniqueness
- Data point continuity
- Data quality assurance
- Configurable collection frequency

## Usage

1. **Configure Collection Tasks**: Create collection task records in the database
2. **Start Collector**: Deploy and run the series collector service
3. **Monitor Data Quality**: Check data collection status through the monitoring system
4. **Data Validation**: Periodically verify the completeness and accuracy of collected data

## Advantages and Features

- **Automation**: Automatically executes data collection tasks
- **Scalability**: Supports multiple data providers
- **Reliability**: Includes error handling and retry mechanisms
- **Efficiency**: Optimizes data storage and query performance

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
