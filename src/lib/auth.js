import jwt from "jsonwebtoken";
import { parse } from "cookie";
import config from "./config";

/**
 * Middleware para verificar a autenticação do usuário
 * @param {Function} handler - O manipulador da API
 * @returns {Function} O manipulador com autenticação
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      // Verificar se a chave secreta JWT está definida
      if (!config.auth.jwtSecret) {
        console.error("❌ JWT_SECRET não configurado no ambiente");
        return res.status(500).json({ 
          error: "Erro de configuração do servidor",
          message: "Autenticação configurada incorretamente" 
        });
      }

      console.log("🔍 Cabeçalhos da requisição:", {
        authorization: req.headers.authorization ? 'Presente (velado)' : 'Ausente',
        cookie: req.headers.cookie ? 'Presente (velado)' : 'Ausente',
        origin: req.headers.origin,
        host: req.headers.host
      });

      // Extrai o token dos cookies ou do header Authorization
      let token = null;
      let tokenSource = '';
      
      try {
        // Primeiro, tenta encontrar o token nos cookies
        const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
        token = cookies.token || cookies.adminToken || null;
        
        if (token) {
          tokenSource = 'cookie';
          console.log("✅ Token extraído do cookie");
        }
        
        // Se não encontrar o token nos cookies, tenta encontrar no cabeçalho Authorization
        if (!token && req.headers.authorization) {
          const authHeader = req.headers.authorization;
          if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' do início
            tokenSource = 'authorization';
            console.log("✅ Token extraído do cabeçalho Authorization");
          }
        }
      } catch (cookieError) {
        console.error("❌ Erro ao analisar cookies:", cookieError.message);
        return res.status(401).json({ error: "Erro ao processar cookies de autenticação" });
      }

      // Verifica se o token está presente
      if (!token) {
        console.warn("⚠ Nenhum token encontrado nos cookies ou cabeçalhos.");
        return res.status(401).json({ error: "Não autenticado" });
      }

      console.log(`🔑 Token encontrado (fonte: ${tokenSource}). Validando...`);

      // Tenta verificar o token JWT com a chave secreta
      try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        
        // Log do conteúdo decodificado (seguro)
        console.log("✅ Token decodificado:", {
          id: decoded.id,
          walletAddress: decoded.walletAddress ? `${decoded.walletAddress.substring(0, 6)}...${decoded.walletAddress.substring(decoded.walletAddress.length - 4)}` : 'não presente',
          authMethod: decoded.authMethod,
          isAdmin: decoded.isAdmin,
          isSuperAdmin: decoded.isSuperAdmin,
          exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'não presente'
        });
        
        // Verificação adicional do conteúdo do token
        if (!decoded || !decoded.id) {
          console.error("❌ Token inválido: Sem ID de usuário");
          return res.status(401).json({ error: "Token inválido (sem ID de usuário)" });
        }
        
        // Adiciona o usuário decodificado à request
        req.user = decoded;
        
        // Chama o handler original com o usuário autenticado
        return handler(req, res);
      } catch (jwtError) {
        // Lidar com diferentes tipos de erros JWT
        if (jwtError.name === 'TokenExpiredError') {
          console.warn("⚠ Token expirado");
          return res.status(401).json({ 
            error: "Sessão expirada", 
            code: "token_expired",
            message: "Sua sessão expirou. Por favor, faça login novamente." 
          });
        } else if (jwtError.name === 'JsonWebTokenError') {
          console.error("❌ Token inválido:", jwtError.message);
          return res.status(401).json({ 
            error: "Token inválido", 
            code: "invalid_token",
            message: "Sua autenticação é inválida. Por favor, faça login novamente." 
          });
        } else {
          console.error("❌ Erro na verificação do token:", jwtError.message);
          return res.status(401).json({ 
            error: "Erro de autenticação", 
            code: "auth_error" 
          });
        }
      }
    } catch (error) {
      console.error("❌ Erro inesperado na autenticação:", error.message);
      return res.status(500).json({ 
        error: "Erro ao verificar a autenticação",
        message: "Ocorreu um erro inesperado ao processar sua autenticação" 
      });
    }
  };
}

/**
 * Função para validar dados do usuário
 * @param {Object} data - Dados a serem validados
 * @param {Array} requiredFields - Campos obrigatórios
 * @returns {Object} Resultado da validação
 */
export function validateUserData(data, requiredFields = []) {
  const errors = {};
  
  // Verifica campos obrigatórios
  for (const field of requiredFields) {
    if (!data[field]) {
      errors[field] = `Campo ${field} é obrigatório`;
    }
  }
  
  // Validação específica por tipo de campo
  
  // Validação de email se existir
  if (data.email) {
    if (typeof data.email !== 'string') {
      errors.email = "Email deve ser uma string";
    } else if (!/\S+@\S+\.\S+/.test(data.email)) {
      errors.email = "Email inválido";
    }
  }
  
  // Validação de telefone se existir
  if (data.phone) {
    if (typeof data.phone !== 'string') {
      errors.phone = "Telefone deve ser uma string";
    } else if (!/^\+?[0-9]{9,15}$/.test(data.phone)) {
      errors.phone = "Telefone inválido";
    }
  }
  
  // Validação de senha se existir
  if (data.password) {
    if (typeof data.password !== 'string') {
      errors.password = "Senha deve ser uma string";
    } else if (data.password.length < 6) {
      errors.password = "Senha deve ter pelo menos 6 caracteres";
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
} 