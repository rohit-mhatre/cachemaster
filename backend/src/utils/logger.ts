import winston from 'winston';
import config from '../config';

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.json(),
  defaultMeta: { service: 'cache-layer' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(
          (info) => `${info.timestamp} [${info.level}]: ${info.message}`
        )
      ),
    }),
  ],
});

// Add file transports in production
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
    })
  );
}

export default logger;
