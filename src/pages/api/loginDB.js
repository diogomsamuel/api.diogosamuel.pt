import { pool } from '../../db/db';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { allowCors } from "../../lib/cors";
import { validateUserData } from "../../lib/auth";
import config from "../../lib/config";
import { isRateLimited, recordLoginFailure, recordLoginSuccess, withRateLimit } from '../../lib/rateLimit';
import { sendWarningAlert } from '../../lib/alerts';

// Valida se o metodo que está a ser chamado é o correto : "POST"
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Verificar se JWT_SECRET está configurado
  if (!config.auth.jwtSecret) {
    console.error("❌ JWT_SECRET não configurado no ambiente");
    return res.status(500).json({ 
      error: "Erro de configuração do servidor",
      message: "Autenticação configurada incorretamente" 
    });
  }

  // Validar dados de entrada
  const { username, password } = req.body;
  
  // Obter IP do cliente
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Verificar se o usuário está bloqueado por excesso de tentativas
  if (username) {
    const limitCheckByUser = isRateLimited(req, res, username);
    if (limitCheckByUser.limited) {
      // Enviar alerta de possível ataque de força bruta
      if (limitCheckByUser.reason === 'user') {
        sendWarningAlert('Possível ataque de força bruta detectado', {
          username,
          ip,
          attempts: 'limite excedido',
          action: 'bloqueio temporário'
        });
      }
      
      return res.status(429).json({ 
        error: "Limite de tentativas excedido", 
        message: limitCheckByUser.message,
        wait: limitCheckByUser.remainingSeconds
      });
    }
  }
  
  // Utilizar a função de validação para verificar os campos
  const { isValid, errors } = validateUserData(
    { username, password },
    ["username", "password"]
  );

  if (!isValid) {
    return res.status(400).json({ 
      error: "Dados de login inválidos", 
      details: errors 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Iniciar uma transação para garantir a consistência dos dados
    await connection.beginTransaction();
    
    try {
      // Consultar usuário por username ou email
      const [rows] = await connection.execute(
        "SELECT id, username, password, is_active, is_verified FROM users WHERE username = ? OR email = ?", 
        [username, username]
      );

      // Se o utilizador não existir, retorna um erro
      if (rows.length === 0) {
        // Registrar tentativa falha
        recordLoginFailure(ip, username);
        
        await connection.rollback();
        connection.release();
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      const user = rows[0];
      
      // Verificar se o usuário está ativo
      if (!user.is_active) {
        // Não registramos como tentativa falha porque o usuário está apenas inativo
        await connection.rollback();
        connection.release();
        return res.status(403).json({ 
          error: "Conta desativada", 
          message: "Sua conta está desativada. Entre em contato com o suporte."
        });
      }

      // Valida se a password é válida
      try {
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // Se a password não for válida, retorna um erro
        if (!isPasswordValid) {
          // Registrar tentativa falha
          recordLoginFailure(ip, username);
          
          await connection.rollback();
          connection.release();
          return res.status(401).json({ error: "Credenciais inválidas" });
        }
      } catch (bcryptError) {
        console.error("Erro ao comparar senhas:", bcryptError);
        throw new Error("Erro na verificação de senha");
      }

      // Login bem-sucedido - limpar contadores de tentativas
      recordLoginSuccess(ip, username);

      // Atualizar o last_login do usuário
      try {
        await connection.execute(
          "UPDATE users SET last_login = NOW() WHERE id = ?",
          [user.id]
        );
      } catch (updateError) {
        console.warn("Aviso: Não foi possível atualizar data de último login:", updateError.message);
        // Continuar mesmo sem atualizar o last_login
      }

      // Dados a incluir no token
      const tokenData = { 
        id: user.id, 
        username: user.username,
        verified: user.is_verified === 1
      };

      // Gera um token JWT com a chave secreta
      let token;
      try {
        token = jwt.sign(
          tokenData, 
          config.auth.jwtSecret, 
          { expiresIn: config.auth.tokenExpire }
        );
      } catch (jwtError) {
        console.error("Erro ao gerar token JWT:", jwtError);
        throw new Error("Erro na geração de token de autenticação");
      }

      // Adiciona o token ao cookie de forma segura
      const cookieOptions = [
        `token=${token}`,
        `Path=/`,
        `HttpOnly`,
        `Secure`,
        `SameSite=None`,
        config.auth.cookieDomain ? `Domain=${config.auth.cookieDomain}` : '',
        `Max-Age=${config.auth.cookieMaxAge}`
      ].filter(Boolean).join('; ');
      
      res.setHeader("Set-Cookie", cookieOptions);
      
      // Commit da transação
      await connection.commit();
      
      // Liberta a conexão
      connection.release();
      
      // Registrar login bem-sucedido
      console.log(`✅ Login bem-sucedido: ${username} (ID: ${user.id})`);
      
      return res.status(200).json({ 
        success: true, 
        token,
        user: {
          id: user.id,
          username: user.username,
          verified: user.is_verified === 1
        }
      });
    } catch (queryError) {
      // Rollback em caso de erro nas consultas
      await connection.rollback();
      throw queryError; // Propagar para o catch externo
    }
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Erro ao fazer rollback:", rollbackError);
      }
      connection.release();
    }
    
    console.error("Erro na autenticação:", error);
    
    // Mensagens de erro específicas
    if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({ 
        error: "Erro de conexão",
        message: "Não foi possível conectar ao banco de dados" 
      });
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ 
        error: "Erro no sistema",
        message: "A estrutura do banco de dados não está configurada corretamente" 
      });
    }
    
    return res.status(500).json({ 
      error: "Erro ao autenticar utilizador",
      message: config.system.isDevelopment ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
}

// Garante o bloqueio de CORS e aplica rate limiting
export default allowCors(withRateLimit(handler));
