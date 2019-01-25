/**
 * Module for providing a configured winston logger
 */
import * as config from "config";
import * as winston from "winston";

const transports = [];

transports.push(new (winston.transports.Console)({level: config.get("LOG_LEVEL") || "info"}));

const logger: winston.Logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
    ),
    level: "info",
    transports,
});

export default logger;
