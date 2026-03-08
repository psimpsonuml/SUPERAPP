const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'beaconops' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, agentId, ...rest }) => {
          const agent = agentId ? ` [${agentId}]` : '';
          const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp} ${level} [${service}]${agent}: ${message}${extra}`;
        })
      ),
    }),
  ],
});

module.exports = logger;
