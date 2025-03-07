import jwt from 'jsonwebtoken';
import { allowCors } from '../../../lib/cors';
import config from '../../../lib/config';

/**
 * Endpoint para verificar se um token de autenticação é válido
 * Usado pelo painel de administração para validar a sessão
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
async function handler(req, res) {
  try {
    // Apenas permitir requisições GET
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    // Log para diagnóstico
    console.log('[AUTH VERIFY] Recebida requisição');
    console.log('[AUTH VERIFY] Headers:', Object.keys(req.headers).join(', '));
    
    // Verificar se a chave JWT está configurada
    if (!config.auth.jwtSecret) {
      console.error('[AUTH VERIFY] JWT_SECRET não configurada!');
      return res.status(500).json({ error: 'Configuração de servidor inválida' });
    }

    // Extrair o token do header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[AUTH VERIFY] Token não fornecido ou formato inválido');
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' do início
    
    // Verificar o token
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      
      // Verificar se é um token de admin
      if (!decoded.isAdmin) {
        console.warn(`[AUTH] Tentativa de acesso admin com token não-admin: ${decoded.id}`);
        return res.status(403).json({ error: 'Permissão negada' });
      }
      
      // Token válido e com permissões de admin
      return res.status(200).json({ 
        success: true,
        userId: decoded.id,
        isAdmin: true,
        isSuperAdmin: decoded.isSuperAdmin || false,
        // Não retornar informações sensíveis
      });
      
    } catch (tokenError) {
      console.error(`[AUTH] Erro ao verificar token: ${tokenError.message}`);
      return res.status(401).json({ error: 'Token inválido' });
    }
    
  } catch (error) {
    console.error('[AUTH] Erro no endpoint verify:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Exportar o handler com CORS permitido
export default allowCors(handler); 