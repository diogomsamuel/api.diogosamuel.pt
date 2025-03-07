/**
 * Sistema de rate limiting para prevenir ataques de força bruta
 * Limita tentativas de login por IP e/ou username
 */

// Armazenamento em memória dos limites
// Em produção, considere usar Redis para persistência e escalabilidade
const ipLimits = new Map();
const userLimits = new Map();
const failedAttempts = new Map();

// Configurações de limite
const LOGIN_MAX_ATTEMPTS = 5;  // Máximo de tentativas por período
const LOGIN_WINDOW_MS = 15 * 60 * 1000;  // Período de 15 minutos
const LOGIN_BLOCK_DURATION_MS = 30 * 60 * 1000;  // Bloqueio de 30 minutos

// Limpar entradas antigas periodicamente (a cada 10 minutos)
setInterval(() => {
  const now = Date.now();
  
  // Limpar registros de IP expirados
  for (const [ip, data] of ipLimits.entries()) {
    if (now > data.resetTime) {
      ipLimits.delete(ip);
    }
  }
  
  // Limpar registros de usuário expirados
  for (const [user, data] of userLimits.entries()) {
    if (now > data.resetTime) {
      userLimits.delete(user);
    }
  }
  
  // Limpar registros de tentativas falhas
  for (const [key, data] of failedAttempts.entries()) {
    if (now > data.timestamp + LOGIN_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Registra uma tentativa de login malsucedida
 * @param {string} ip - Endereço IP
 * @param {string} username - Nome de usuário
 * @returns {void}
 */
export function recordLoginFailure(ip, username) {
  const now = Date.now();
  const ipKey = `ip:${ip}`;
  const userKey = `user:${username}`;
  
  // Registrar tentativa por IP
  if (!failedAttempts.has(ipKey)) {
    failedAttempts.set(ipKey, { count: 1, timestamp: now });
  } else {
    const data = failedAttempts.get(ipKey);
    data.count += 1;
    failedAttempts.set(ipKey, data);
  }
  
  // Registrar tentativa por usuário se fornecido
  if (username) {
    if (!failedAttempts.has(userKey)) {
      failedAttempts.set(userKey, { count: 1, timestamp: now });
    } else {
      const data = failedAttempts.get(userKey);
      data.count += 1;
      failedAttempts.set(userKey, data);
    }
  }
  
  // Verificar se deve bloquear o IP
  const ipData = failedAttempts.get(ipKey);
  if (ipData && ipData.count >= LOGIN_MAX_ATTEMPTS) {
    ipLimits.set(ip, {
      blockedUntil: now + LOGIN_BLOCK_DURATION_MS,
      resetTime: now + LOGIN_BLOCK_DURATION_MS
    });
    
    // Limpar as tentativas após o bloqueio
    failedAttempts.delete(ipKey);
    
    console.warn(`🔒 IP ${ip} bloqueado por ${LOGIN_BLOCK_DURATION_MS/60000} minutos após ${ipData.count} tentativas falhas`);
  }
  
  // Verificar se deve bloquear o usuário
  if (username) {
    const userData = failedAttempts.get(userKey);
    if (userData && userData.count >= LOGIN_MAX_ATTEMPTS) {
      userLimits.set(username, {
        blockedUntil: now + LOGIN_BLOCK_DURATION_MS,
        resetTime: now + LOGIN_BLOCK_DURATION_MS
      });
      
      // Limpar as tentativas após o bloqueio
      failedAttempts.delete(userKey);
      
      console.warn(`🔒 Usuário ${username} bloqueado por ${LOGIN_BLOCK_DURATION_MS/60000} minutos após ${userData.count} tentativas falhas`);
    }
  }
}

/**
 * Registra um login bem-sucedido e reseta os contadores
 * @param {string} ip - Endereço IP
 * @param {string} username - Nome de usuário
 * @returns {void}
 */
export function recordLoginSuccess(ip, username) {
  const ipKey = `ip:${ip}`;
  const userKey = `user:${username}`;
  
  // Remover tentativas falhas por IP
  failedAttempts.delete(ipKey);
  
  // Remover tentativas falhas por usuário
  if (username) {
    failedAttempts.delete(userKey);
  }
}

/**
 * Middleware para verificar se o IP ou usuário está bloqueado
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} username - Nome de usuário opcional
 * @returns {boolean} True se bloqueado, false caso contrário
 */
export function isRateLimited(req, res, username = null) {
  const now = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Verificar bloqueio por IP
  if (ipLimits.has(ip)) {
    const ipLimit = ipLimits.get(ip);
    
    if (now < ipLimit.blockedUntil) {
      const remainingSeconds = Math.ceil((ipLimit.blockedUntil - now) / 1000);
      
      if (res) {
        res.setHeader('X-RateLimit-Reset', new Date(ipLimit.blockedUntil).toISOString());
        res.setHeader('Retry-After', remainingSeconds);
      }
      
      return {
        limited: true,
        reason: 'ip',
        message: `Muitas tentativas de login. Tente novamente em ${remainingSeconds} segundos.`,
        remainingSeconds
      };
    } else {
      // Remover bloqueio expirado
      ipLimits.delete(ip);
    }
  }
  
  // Verificar bloqueio por usuário
  if (username && userLimits.has(username)) {
    const userLimit = userLimits.get(username);
    
    if (now < userLimit.blockedUntil) {
      const remainingSeconds = Math.ceil((userLimit.blockedUntil - now) / 1000);
      
      if (res) {
        res.setHeader('X-RateLimit-Reset', new Date(userLimit.blockedUntil).toISOString());
        res.setHeader('Retry-After', remainingSeconds);
      }
      
      return {
        limited: true,
        reason: 'user',
        message: `Conta temporariamente bloqueada. Tente novamente em ${remainingSeconds} segundos ou recupere sua senha.`,
        remainingSeconds
      };
    } else {
      // Remover bloqueio expirado
      userLimits.delete(username);
    }
  }
  
  // Não bloqueado
  return { limited: false };
}

/**
 * Verifica o histórico de tentativas falhas
 * @param {string} ip - Endereço IP
 * @param {string} username - Nome de usuário
 * @returns {Object} Informações sobre tentativas falhas
 */
export function getLoginAttempts(ip, username = null) {
  const now = Date.now();
  const ipKey = `ip:${ip}`;
  const userKey = username ? `user:${username}` : null;
  
  const ipAttempts = failedAttempts.has(ipKey) ? failedAttempts.get(ipKey).count : 0;
  const userAttempts = userKey && failedAttempts.has(userKey) ? failedAttempts.get(userKey).count : 0;
  const maxAttempts = LOGIN_MAX_ATTEMPTS;
  
  return {
    ipAttempts,
    userAttempts,
    maxAttempts,
    remaining: Math.max(0, maxAttempts - Math.max(ipAttempts, userAttempts)),
    isBlocked: ipLimits.has(ip) || (username && userLimits.has(username))
  };
}

/**
 * Middleware para aplicar rate limit
 * @param {Function} handler - API handler
 * @returns {Function} Handler com rate limit
 */
export function withRateLimit(handler) {
  return async (req, res) => {
    // Apenas verificar rate limit para rotas de autenticação
    const isAuthRoute = req.url.includes('/api/login') || req.url.includes('/api/register');
    
    if (isAuthRoute) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      
      // Verificar se o IP está bloqueado (sem verificar usuário porque ainda não sabemos)
      const limitCheck = isRateLimited(req, res);
      
      if (limitCheck.limited) {
        return res.status(429).json({
          error: 'Muitas tentativas',
          message: limitCheck.message
        });
      }
      
      // Adicionar informações de tentativas aos cabeçalhos
      const attempts = getLoginAttempts(ip);
      res.setHeader('X-RateLimit-Limit', LOGIN_MAX_ATTEMPTS);
      res.setHeader('X-RateLimit-Remaining', attempts.remaining);
    }
    
    // Continuar com o handler original
    return handler(req, res);
  };
}