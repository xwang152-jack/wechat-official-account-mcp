/**
 * Logger utility for MCP server
 */

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

class ConsoleLogger implements Logger {
  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}

export const logger: Logger = new ConsoleLogger();