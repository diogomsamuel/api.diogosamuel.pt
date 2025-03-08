import { allowCors } from '../../../lib/cors';
import jwt from 'jsonwebtoken';
import config from '../../../lib/config';

/**
 * Endpoint de diagnóstico para ajudar a identificar problemas de CORS e autenticação
 * Fornece detalhes sobre a requisição, cabeçalhos e token JWT
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
async function handler(req, res) {
  try {
    console.log('[DEBUG] Recebido pedido de diagnóstico');
    
    // Coletar informações de diagnóstico
    const diagnosticInfo = {
      timestamp: new Date().toISOString(),
      request: {
        method: req.method,
        url: req.url,
        query: req.query,
      },
      headers: {
        // Filtrar cabeçalhos sensíveis
        origin: req.headers.origin || null,
        referer: req.headers.referer || null,
        host: req.headers.host || null,
        'user-agent': req.headers['user-agent'] || null,
        'content-type': req.headers['content-type'] || null,
        'accept': req.headers.accept || null,
        'authorization': req.headers.authorization ? 'Present (masked)' : 'Not present',
        'cookie': req.headers.cookie ? 'Present (masked)' : 'Not present',
      },
      cors: {
        allowedOrigins: config.cors.allowedOrigins,
        isOriginAllowed: req.headers.origin ? config.cors.allowedOrigins.includes(req.headers.origin) : false,
        isDevelopment: config.system.isDevelopment,
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        apiUrl: config.system.apiUrl,
        frontendUrl: config.system.frontendUrl,
        adminUrl: config.system.adminUrl,
      }
    };
    
    // Verificar token JWT se presente
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        diagnosticInfo.auth = {
          tokenValid: true,
          tokenInfo: {
            id: decoded.id,
            isAdmin: decoded.isAdmin || false,
            isSuperAdmin: decoded.isSuperAdmin || false,
            exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
            iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
          }
        };
      } catch (tokenError) {
        diagnosticInfo.auth = {
          tokenValid: false,
          error: tokenError.message
        };
      }
    } else {
      diagnosticInfo.auth = {
        tokenValid: false,
        reason: 'No token provided'
      };
    }
    
    console.log('[DEBUG] Informações de diagnóstico:', JSON.stringify(diagnosticInfo, null, 2));
    
    return res.status(200).json({
      message: 'Informações de diagnóstico coletadas com sucesso',
      diagnosticInfo
    });
  } catch (error) {
    console.error('[DEBUG] Erro no endpoint de diagnóstico:', error);
    return res.status(500).json({
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
}

export default allowCors(handler); 