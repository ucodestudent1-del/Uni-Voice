import pino from "pino";
import { env } from "../config/index.js";

function createLogger() {
  if (env.APP_ENV === "development" || env.APP_ENV === "test") {
    return pino({
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: true },
      },
    });
  }
  return pino({ level: "info" });
}

export const logger = createLogger();
