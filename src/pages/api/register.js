import { pool } from '../../db/db';
import bcrypt from "bcrypt";
import { allowCors } from "../../lib/cors";
import { validateUserData } from "../../lib/auth";

// Valida se o metodo que está a ser chamado é o correto : "POST"
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Extrai os dados do corpo da requisição
  const { 
    username, 
    password, 
    email, 
    first_name, 
    last_name, 
    phone,
    birth_date 
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
    connection = await pool.getConnection();
    
    // Verifica se o username já existe
    const [existingUser] = await connection.execute(
      "SELECT id FROM users WHERE username = ? OR email = ?", 
      [username, email]
    );

    if (existingUser.length > 0) {
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
    await connection.execute(
      "INSERT INTO user_profiles (user_id, created_at) VALUES (?, NOW())",
      [userId]
    );

    // Libera a conexão
    connection.release();
    
    console.log(`✅ Novo usuário registrado: ID=${userId}, Username=${username}`);
    
    return res.status(201).json({ 
      success: true, 
      message: "Usuário registrado com sucesso",
      userId
    });
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao registrar usuário:", error);
    return res.status(500).json({ error: "Erro ao registrar usuário" });
  }
}

// Garante o bloqueio de CORS - Cross-Origin Resource Sharing.
export default allowCors(handler);