import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  // Verificar se o usuário é administrador
  if (!req.user || req.user.walletAddress !== process.env.ADMIN_WALLET) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // GET: Listar usuários
    if (req.method === "GET") {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const search = req.query.search;

      let query = `
        SELECT 
          id, username, email, first_name, last_name, display_name,
          created_at as registeredAt, last_login, is_active as status,
          wallet_address, login_type
        FROM users
      `;

      const queryParams = [];

      if (search) {
        query += `
          WHERE username LIKE ? OR email LIKE ? OR 
          first_name LIKE ? OR last_name LIKE ? OR 
          display_name LIKE ? OR wallet_address LIKE ?
        `;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const [users] = await connection.execute(query, queryParams);

      // Contar total de usuários para paginação
      let countQuery = "SELECT COUNT(*) as total FROM users";
      if (search) {
        countQuery += `
          WHERE username LIKE ? OR email LIKE ? OR 
          first_name LIKE ? OR last_name LIKE ? OR 
          display_name LIKE ? OR wallet_address LIKE ?
        `;
      }

      const [countResult] = await connection.execute(
        countQuery,
        search ? Array(6).fill(`%${search}%`) : []
      );

      connection.release();
      return res.status(200).json({
        users,
        pagination: {
          total: countResult[0].total,
          limit,
          offset
        }
      });
    }

    // PUT: Atualizar usuário
    else if (req.method === "PUT") {
      const { id } = req.query;
      const { is_active } = req.body;

      if (!id) {
        return res.status(400).json({ error: "ID do usuário não fornecido" });
      }

      await connection.execute(
        "UPDATE users SET is_active = ? WHERE id = ?",
        [is_active, id]
      );

      connection.release();
      return res.status(200).json({ success: true });
    }

    // DELETE: Excluir usuário
    else if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: "ID do usuário não fornecido" });
      }

      await connection.execute(
        "DELETE FROM users WHERE id = ?",
        [id]
      );

      connection.release();
      return res.status(200).json({ success: true });
    }

    // Método não permitido
    else {
      connection.release();
      return res.status(405).json({ error: "Método não permitido" });
    }

  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro na operação de usuários:", error);
    return res.status(500).json({ error: "Erro ao processar operação de usuários" });
  }
}

// Proteger a rota com CORS e autenticação
export default allowCors(withAuth(handler)); 