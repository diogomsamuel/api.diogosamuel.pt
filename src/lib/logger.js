const winston = require('winston');
const { format } = winston;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Custom format for logs
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  format.colorize({ all: true }),
  format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    
    // Write all errors to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: format.combine(
        format.uncolorize(),
        format.json()
      ),
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: format.combine(
        format.uncolorize(),
        format.json()
      ),
    }),
  ],
});

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger; 