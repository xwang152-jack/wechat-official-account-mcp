export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

/**
 * 敏感字段名称列表,这些字段的值应该被脱敏
 */
const SENSITIVE_FIELDS = [
  'appSecret',
  'app_secret',
  'secret',
  'accessToken',
  'access_token',
  'token',
  'encodingAesKey',
  'encoding_aes_key',
  'password',
  'apiKey',
  'api_key',
];

/**
 * 脱敏处理 - 隐藏敏感信息的中间部分
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // 检查是否像 token 或 secret
    if (value.length > 16) {
      return `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
    }
    return '***';
  }

  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // 检查键名是否为敏感字段
      const isSensitive = SENSITIVE_FIELDS.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      );

      sanitized[key] = isSensitive ? sanitizeValue(val) : sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    if (level >= this.level) {
      const timestamp = new Date().toISOString();
      const levelName = LogLevel[level];

      // 脱敏所有参数
      const sanitizedArgs = args.map(arg => sanitizeValue(arg));

      console.log(`[${timestamp}] [${levelName}] ${message}`, ...sanitizedArgs);
    }
  }

  trace(message: string, ...args: unknown[]) {
    this.log(LogLevel.TRACE, message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

export const logger = new Logger();