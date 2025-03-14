import jwt from "jsonwebtoken";
import { parse } from "cookie";
import config from "./config";

/**
 * Middleware de autenticação
 * Verifica se o utilizador está autenticado através do token JWT
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      // Verificar se o cabeçalho de autorização está presente
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: "Token em falta",
          code: "missing_token",
          message: "Autenticação necessária para aceder a este recurso"
        });
      }
      
      // Extrair o token do cabeçalho
      const token = authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          error: "Token em falta",
          code: "missing_token",
          message: "Autenticação necessária para aceder a este recurso"
        });
      }
      
      // Verificar o token
      try {
        // Verificar o token e extrair os dados do utilizador
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Adicionar o objeto do utilizador à requisição
        req.user = decoded;
        
        // Continuar com o handler
        return handler(req, res);
      } catch (tokenError) {
        console.error('[AUTH] Erro na validação do token:', tokenError);
        
        // Erros específicos de token
        if (tokenError.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: "Token expirado",
            code: "expired_token",
            message: "A sua sessão expirou. Por favor, inicie sessão novamente."
          });
        }
        
        return res.status(401).json({
          error: "Token inválido",
          code: "invalid_token",
          message: "A sua autenticação é inválida. Por favor, inicie sessão novamente."
        });
      }
    } catch (error) {
      console.error('[AUTH] Erro no middleware de autenticação:', error);
      return res.status(500).json({
        error: "Erro de autenticação",
        code: "auth_error",
        message: "Ocorreu um erro ao processar a autenticação"
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