import { pool } from '../../db/db';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { allowCors } from "../../lib/cors";
import { validateUserData } from "../../lib/auth";
import config from "../../lib/config";
import { isRateLimited, withRateLimit } from "../../lib/rateLimit";
import { sendWarningAlert } from "../../lib/alerts";

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

  // Obter IP do cliente
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Verificar rate limit por IP (sem username ainda porque é novo registro)
  const limitCheck = isRateLimited(req, res);
  if (limitCheck.limited) {
    // Enviar alerta de possível abuso do endpoint de registro
    sendWarningAlert('Possível abuso do endpoint de registro', {
      ip,
      attempts: 'limite excedido',
      action: 'bloqueio temporário'
    });
    
    return res.status(429).json({ 
      error: "Limite de tentativas excedido", 
      message: limitCheck.message,
      wait: limitCheck.remainingSeconds
    });
  }

  // Extrai os dados do corpo da requisição
  const { 
    username, 
    password, 
    email, 
    first_name, 
    last_name, 
    phone,
    birth_date,
    height,
    initial_weight,
    fitness_level,
    fitness_goals,
    health_conditions
  } = req.body;

  // Validação básica dos campos obrigatórios
  const { isValid, errors } = validateUserData(
    { username, password, email },
    ["username", "password", "email"]
  );

  if (!isValid) {
    return res.status(400).json({ error: "Dados inválidos", details: errors });
  }

  let connection;
  try {
    // Validação adicional de parâmetros
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: "Username inválido" });
    }
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    }

    connection = await pool.getConnection();
    
    // Iniciar transação para garantir consistência dos dados
    await connection.beginTransaction();
    
    // Verifica se o username já existe
    const [existingUser] = await connection.execute(
      "SELECT id FROM users WHERE username = ? OR email = ?", 
      [username, email]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ error: "Username ou email já existente" });
    }

    // Criptografa a senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Prepara o display_name baseado no first_name e last_name se existirem
    const display_name = first_name && last_name 
      ? `${first_name} ${last_name}` 
      : username;

    try {
      // Cria o novo usuário com os campos adicionais
      const [result] = await connection.execute(
        `INSERT INTO users (
          username, password, first_name, last_name, 
          display_name, email, phone, birth_date, 
          is_active, is_verified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())`,
        [
          username, 
          hashedPassword, 
          first_name || null, 
          last_name || null, 
          display_name,
          email,
          phone || null,
          birth_date || null
        ]
      );

      const userId = result.insertId;

      // Cria o perfil básico do usuário
      try {
        await connection.execute(
          "INSERT INTO user_profiles (user_id, created_at) VALUES (?, NOW())",
          [userId]
        );
      } catch (profileError) {
        console.warn("Aviso: Não foi possível criar o perfil do usuário:", profileError.message);
        // Continuar mesmo sem criar o perfil
      }

      // Salva as informações físicas se fornecidas
      if (height || initial_weight) {
        try {
          await connection.execute(
            "INSERT INTO body_measurements (user_id, height, weight, measured_at) VALUES (?, ?, ?, NOW())",
            [userId, height || null, initial_weight || null]
          );
        } catch (measurementsError) {
          console.warn("Aviso: Não foi possível salvar as medidas físicas:", measurementsError.message);
          // Continuar mesmo sem salvar as medidas
        }
      }

      // Salva os objetivos de fitness se fornecidos
      if (fitness_goals) {
        try {
          await connection.execute(
            "INSERT INTO user_goals (user_id, description, created_at) VALUES (?, ?, NOW())",
            [userId, fitness_goals]
          );
        } catch (goalsError) {
          console.warn("Aviso: Não foi possível salvar os objetivos de fitness:", goalsError.message);
          // Continuar mesmo sem salvar os objetivos
        }
      }

      // Dados a incluir no token
      const tokenData = { 
        id: userId, 
        username: username,
        verified: 0 // Novo usuário não é verificado inicialmente
      };
      
      // Gera um token JWT após o registro
      const token = jwt.sign(
        tokenData, 
        config.auth.jwtSecret, 
        { expiresIn: config.auth.tokenExpire }
      );

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
      
      // Libera a conexão
      connection.release();
      
      console.log(`Novo usuário registrado: ID=${userId}, Username=${username}`);
      
      return res.status(201).json({ 
        success: true, 
        message: "Usuário registrado com sucesso",
        userId,
        token,
        user: {
          id: userId,
          username,
          verified: false
        }
      });
    } catch (insertError) {
      // Fazer rollback em caso de erro na inserção
      await connection.rollback();
      throw insertError; // Propagar o erro para o catch externo
    }
  } catch (error) {
    if (connection) {
      try {
        // Garantir que a transação seja revertida em caso de erro
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Erro ao fazer rollback:", rollbackError);
      }
      connection.release();
    }
    
    // Log do erro para diagnóstico no servidor
    console.error("Erro ao registrar usuário:", error);
    
    // Se for um erro relacionado às tabelas
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ 
        error: "Erro no sistema de registro",
        message: "A estrutura do banco de dados não está configurada corretamente"
      });
    }
    
    // Mensagem genérica para o cliente em produção
    return res.status(500).json({ 
      error: "Erro ao registrar usuário",
      message: config.system.isDevelopment ? error.message : "Ocorreu um erro ao processar seu registro"
    });
  }
}

// Garante o bloqueio de CORS - Cross-Origin Resource Sharing.
export default allowCors(withRateLimit(handler));