// packages/mobile/src/services/MobileLoggerProvider.ts
import { LogLevel, LogProvider } from "@hub-spoke/core";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { configLoggerType, consoleTransport, logger } from "react-native-logs";

/**
 * Production-ready Logger Provider using react-native-logs.
 * This implementation provides colored console output, environment-aware
 * filtering, and device metadata for easier debugging.
 */
const logConfig: configLoggerType<any, LogLevel> = {
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  severity: __DEV__ ? "debug" : "info",
  transport: consoleTransport,
  transportOptions: {
    colors: {
      info: "blueBright",
      warn: "yellowBright",
      error: "redBright",
    },
    extensionColors: {
      CORE: "magenta",
    },
  },
  async: true, // Improves performance by not blocking the UI thread
  dateFormat: "time",
  printLevel: true,
};

export class MobileLoggerProvider implements LogProvider {
  private logInstance;
  private deviceMeta: string;

  constructor() {
    // Initialize the react-native-logs instance
    this.logInstance = logger.createLogger(logConfig).extend("CORE");

    // Metadata for identifying the hardware context
    this.deviceMeta = `${Device.brand} ${Device.modelName}`;
  }

  /**
   * Maps our Core LogLevels to the react-native-logs methods.
   */
  log(level: LogLevel, message: string, meta?: any): void {
    const context = {
      device: this.deviceMeta,
      env: Constants.executionEnvironment,
      ...(meta && { details: meta }),
    };

    switch (level) {
      case "debug":
        this.logInstance.debug(message, context);
        break;
      case "info":
        this.logInstance.info(message, context);
        break;
      case "warn":
        this.logInstance.warn(message, context);
        break;
      case "error":
        this.logInstance.error(message, context);
        break;
    }
  }
}
