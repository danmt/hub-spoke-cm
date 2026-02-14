// packages/core/src/services/LoggerService.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * The platform (CLI or Mobile) must implement this interface.
 */
export interface LogProvider {
  log(level: LogLevel, message: string, meta?: any): void;
}

export class LoggerService {
  private static provider: LogProvider | null = null;

  /**
   * Called by the CLI or Mobile App entry point during initialization.
   */
  static setProvider(provider: LogProvider): void {
    this.provider = provider;
  }

  static async debug(message: string, meta?: any) {
    this.execute("debug", message, meta);
  }
  static async info(message: string, meta?: any) {
    this.execute("info", message, meta);
  }
  static async warn(message: string, meta?: any) {
    this.execute("warn", message, meta);
  }
  static async error(message: string, meta?: any) {
    this.execute("error", message, meta);
  }

  private static execute(level: LogLevel, message: string, meta?: any) {
    if (this.provider) {
      this.provider.log(level, message, meta);
    } else {
      // Basic fallback to prevent silent failures if provider isn't set yet
      const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
      if (level === "error" || process.env.DEBUG === "true") {
        console.log(
          `[${timestamp}] [BOOTSTRAP-${level.toUpperCase()}]: ${message}`,
          meta || "",
        );
      }
    }
  }
}
