const logger = require('../lib/logger');

function requestLogger(req, res, next) {
  // Start timer
  const start = Date.now();

  // Log request
  const logRequest = () => {
    // Calculate response time
    const responseTime = Date.now() - start;

    // Basic request information
    const logInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown',
      referer: req.get('referer') || 'unknown',
    };

    // Add user information if authenticated
    if (req.user) {
      logInfo.userId = req.user.id;
      logInfo.username = req.user.username;
    }

    // Add request body for non-GET requests (excluding sensitive data)
    if (req.method !== 'GET' && req.body) {
      const sanitizedBody = { ...req.body };
      // Remove sensitive fields
      delete sanitizedBody.password;
      delete sanitizedBody.confirmPassword;
      delete sanitizedBody.token;
      logInfo.body = sanitizedBody;
    }

    // Add query parameters
    if (Object.keys(req.query).length > 0) {
      logInfo.query = req.query;
    }

    // Log based on response status
    if (res.statusCode >= 500) {
      logger.error('Request failed', logInfo);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logInfo);
    } else {
      logger.info('Request completed', logInfo);
    }
  };

  // Log when the response is finished
  res.on('finish', logRequest);
  res.on('close', logRequest);

  next();
}

module.exports = requestLogger; 