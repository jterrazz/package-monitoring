# Package Monitoring

A TypeScript-based monitoring utility designed with clean port/adapter principles, providing flexible and extensible application monitoring capabilities for Node.js applications.

## Features

- 📊 Type-safe monitoring interface
- 🔌 Pluggable monitoring adapters
- 💪 100% TypeScript
- 🚀 Production-ready with no-op adapter
- 📈 NewRelic integration support
- ⏱️ Transaction and segment monitoring
- 📊 Custom metrics recording

## Installation

```bash
npm install @jterrazz/monitoring
```

## Usage

### Basic Usage

```typescript
import { NewRelicMonitoringAdapter, NoopMonitoringAdapter } from '@jterrazz/monitoring';
import { Logger } from '@jterrazz/logger';

// Development environment with NewRelic
const devMonitoring = new NewRelicMonitoringAdapter({
  environment: 'development',
  licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
  logger: new Logger(/* ... */),
});

// Production environment with No-op
const prodMonitoring = new NoopMonitoringAdapter();

// Initialize monitoring
await monitoring.initialize();

// Monitor a transaction
await monitoring.monitorTransaction('User', 'Create', async () => {
  // Your business logic here
});

// Monitor a segment
await monitoring.monitorSegment('User/Profile/Update', async () => {
  // Your operation here
});

// Record metrics
monitoring.recordCount('User', 'Login', 1);
monitoring.recordMeasurement('Performance', 'ResponseTime', 150);
```

### Available Adapters

- **NewRelicMonitoringAdapter**: Full-featured monitoring with NewRelic (recommended for production)

  ```typescript
  new NewRelicMonitoringAdapter({
    environment: 'production',
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
    logger: new Logger(/* ... */),
  });
  ```

- **NoopMonitoringAdapter**: Zero-overhead monitoring (recommended for development or testing)
  ```typescript
  new NoopMonitoringAdapter();
  ```

## Architecture

This package follows the hexagonal (ports and adapters) architecture:

- `src/ports/`: Contains the core interfaces and types
  - `monitoring.port.ts`: Defines the monitoring interface
- `src/adapters/`: Implements various monitoring adapters
  - `new-relic.adapter.ts`: NewRelic-based monitoring
  - `noop.adapter.ts`: No-operation monitoring

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Author

- Jean-Baptiste Terrazzoni ([@jterrazz](https://github.com/jterrazz))
- Email: contact@jterrazz.com
