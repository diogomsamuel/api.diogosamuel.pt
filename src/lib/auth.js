import jwt from "jsonwebtoken";
import { parse } from "cookie";

/**
 * Middleware para verificar a autenticação do usuário
 * @param {Function} handler - O manipulador da API
 * @returns {Function} O manipulador com autenticação
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      // Garante que o header "cookie" existe antes de tentar analisá-lo
      const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
      const token = cookies.token || null;

      // Verifica se o token está presente
      if (!token) {
        console.warn("⚠ Nenhum token encontrado nos cookies.");
        return res.status(401).json({ error: "Não autenticado" });
      }

      // Tenta verificar o token JWT com a chave secreta
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Adiciona o usuário decodificado à request
        req.user = decoded;
        
        // Chama o handler original com o usuário autenticado
        return handler(req, res);
      } catch (error) {
        console.error("❌ Token inválido ou expirado:", error.message);
        return res.status(401).json({ error: "Token inválido ou expirado" });
      }
    } catch (error) {
      console.error("❌ Erro inesperado na autenticação:", error.message);
      return res.status(500).json({ error: "Erro ao verificar a autenticação" });
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
  
  // Validação de email se existir
  if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = "Email inválido";
  }
  
  // Validação de telefone se existir
  if (data.phone && !/^\+?[0-9]{9,15}$/.test(data.phone)) {
    errors.phone = "Telefone inválido";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
} 