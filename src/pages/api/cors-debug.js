import config from '../../lib/config';
import { allowCors } from '../../lib/cors';

async function handler(req, res) {
  // Obter a origem da requisição
  const origin = req.headers.origin || 'null';
  
  // Devolver informações sobre a configuração CORS
  return res.status(200).json({
    allowedOrigins: config.cors.allowedOrigins,
    requestOrigin: origin,
    isDevelopment: config.system.isDevelopment,
    serverTime: new Date().toISOString(),
    corsAllowPostman: config.cors.allowPostman,
    corsAllowAnyOriginInDev: config.cors.allowAnyOriginInDev
  });
}

// Exportar o handler com CORS habilitado. Nesta rota de debug, 
// não passamos pela verificação normal de CORS para poder diagnosticar problemas
export default function corsDebug(req, res) {
  const origin = req.headers.origin || '';
  
  // Definir manualmente os headers CORS para esta rota específica
  // Permite qualquer origem válida, incluindo origens com credenciais
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Se for OPTIONS, responder OK imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Caso contrário, chamar o handler
  return handler(req, res);
} 