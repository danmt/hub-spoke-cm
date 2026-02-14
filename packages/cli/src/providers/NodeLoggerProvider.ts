// packages/cli/src/services/WinstonLoggerProvider.ts
import { LogLevel, LogProvider } from "@hub-spoke/core";
import fs from "fs";
import path from "path";
import winston from "winston";
import "winston-daily-rotate-file";

export class NodeLoggerProvider implements LogProvider {
  private logger: winston.Logger;

  constructor(workspaceRoot?: string) {
    const isDebug = process.env.DEBUG === "true";
    const transports: winston.transport[] = [];

    // Exact same Console Behavior: debug if flag is on, otherwise only errors
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

    // Exact same File Behavior: add if workspaceRoot is provided
    if (workspaceRoot) {
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
          level: "debug", // Always log everything to the file
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    this.logger = winston.createLogger({
      level: "debug",
      transports,
    });
  }

  log(level: LogLevel, message: string, meta?: any): void {
    this.logger.log(level, message, meta);
  }
}
