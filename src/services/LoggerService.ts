// src/services/LoggerService.ts
import fs from "fs";
import path from "path";
import winston from "winston";
import "winston-daily-rotate-file";
import { IoService } from "./IoService.js";

export class LoggerService {
  private static instance: winston.Logger | null = null;

  /**
   * Lazy-loads the winston instance.
   * Dynamically checks for workspace root to configure file transports.
   */
  private static async getInstance(): Promise<winston.Logger> {
    if (this.instance) return this.instance;

    const isDebug = process.env.DEBUG === "true";
    const transports: winston.transport[] = [];

    // Always include Console Transport
    transports.push(
      new winston.transports.Console({
        level: isDebug ? "debug" : "error",
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: "HH:mm:ss" }),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? ` ${JSON.stringify(meta)}`
              : "";
            return `[${timestamp}] ${level}: ${message}${metaStr}`;
          }),
        ),
      }),
    );

    // Attempt to add File Transport if inside a workspace
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const logDir = path.join(workspaceRoot, ".hub", "logs");

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      transports.push(
        new winston.transports.DailyRotateFile({
          dirname: logDir,
          filename: "hub-trace-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          zippedArchive: true,
          maxSize: "20m",
          maxFiles: "14d",
          level: "debug",
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    } catch {
      // Not in a workspace; file logging is skipped
    }

    this.instance = winston.createLogger({
      level: "debug",
      transports,
    });

    return this.instance;
  }

  static async debug(message: string, meta?: any) {
    const logger = await this.getInstance();
    logger.debug(message, meta);
  }

  static async info(message: string, meta?: any) {
    const logger = await this.getInstance();
    logger.info(message, meta);
  }

  static async warn(message: string, meta?: any) {
    const logger = await this.getInstance();
    logger.warn(message, meta);
  }

  static async error(message: string, meta?: any) {
    const logger = await this.getInstance();
    logger.error(message, meta);
  }
}
