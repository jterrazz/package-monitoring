# Package Logger

A TypeScript-based logging utility designed with clean architecture principles, providing flexible and extensible logging capabilities for Node.js and React Native applications.

## Features

- 📝 Type-safe logging interface
- 🔌 Pluggable logging adapters
- 💪 100% TypeScript
- 🚀 Production-ready with no-op adapter
- 📱 React Native compatible

## Installation

```bash
npm install @jterrazz/logger
```

## Usage

### Basic Usage

```typescript
import { Logger } from '@jterrazz/logger';
import { PinoLoggerAdapter } from '@jterrazz/logger/adapters/pino';
import { NoopLoggerAdapter } from '@jterrazz/logger/adapters/noop';

// Development environment with Pino
const devLogger = new Logger({
  adapter: new PinoLoggerAdapter({
    prettyPrint: true,
    level: 'debug',
  }),
});

// Production environment with No-op
const prodLogger = new Logger({
  adapter: new NoopLoggerAdapter(),
});

// Log messages
logger.info('Application started');
logger.error('An error occurred', { error: new Error('Something went wrong') });
```

### Available Adapters

- **PinoLoggerAdapter**: Full-featured logging with Pino (recommended for development)

  ```typescript
  new PinoLoggerAdapter({
    prettyPrint: true, // Enable pretty printing
    level: 'debug', // Set minimum log level
  });
  ```

- **NoopLoggerAdapter**: Zero-overhead logging (recommended for client side production)
  ```typescript
  new NoopLoggerAdapter();
  ```

## Architecture

This package follows the hexagonal (ports and adapters) architecture:

- `src/ports/`: Contains the core interfaces and types
- `src/adapters/`: Implements various logging adapters
  - `pino.adapter.ts`: Pino-based logging
  - `noop.adapter.ts`: No-operation logging

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Author

- Jean-Baptiste Terrazzoni ([@jterrazz](https://github.com/jterrazz))
- Email: contact@jterrazz.com
