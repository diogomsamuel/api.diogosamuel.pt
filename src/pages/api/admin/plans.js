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

    // GET: Listar planos
    if (req.method === "GET") {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const search = req.query.search;

      let query = `
        SELECT 
          p.id, p.name, p.description, p.short_description,
          p.base_price, p.discount_price, p.is_active,
          p.created_at, p.updated_at, p.version, p.status,
          COUNT(DISTINCT pv.id) as variants,
          COUNT(DISTINCT pu.id) as sales
        FROM training_plans p
        LEFT JOIN plan_variants pv ON p.id = pv.plan_id
        LEFT JOIN purchases pu ON p.id = pu.plan_id AND pu.status = 'completed'
      `;

      const queryParams = [];

      if (search) {
        query += `
          WHERE p.name LIKE ? OR p.description LIKE ? OR 
          p.short_description LIKE ?
        `;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const [plans] = await connection.execute(query, queryParams);

      // Contar total de planos para paginação
      let countQuery = "SELECT COUNT(*) as total FROM training_plans";
      if (search) {
        countQuery += `
          WHERE name LIKE ? OR description LIKE ? OR 
          short_description LIKE ?
        `;
      }

      const [countResult] = await connection.execute(
        countQuery,
        search ? Array(3).fill(`%${search}%`) : []
      );

      connection.release();
      return res.status(200).json({
        plans,
        pagination: {
          total: countResult[0].total,
          limit,
          offset
        }
      });
    }

    // POST: Criar plano
    else if (req.method === "POST") {
      const {
        name,
        description,
        short_description,
        base_price,
        discount_price,
        stripe_product_id,
        stripe_price_id
      } = req.body;

      const [result] = await connection.execute(`
        INSERT INTO training_plans (
          name, description, short_description, base_price,
          discount_price, stripe_product_id, stripe_price_id,
          is_active, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'published')
      `, [
        name,
        description,
        short_description,
        base_price,
        discount_price,
        stripe_product_id,
        stripe_price_id
      ]);

      connection.release();
      return res.status(201).json({
        success: true,
        planId: result.insertId
      });
    }

    // PUT: Atualizar plano
    else if (req.method === "PUT") {
      const { id } = req.query;
      const {
        name,
        description,
        short_description,
        base_price,
        discount_price,
        is_active,
        stripe_product_id,
        stripe_price_id
      } = req.body;

      if (!id) {
        return res.status(400).json({ error: "ID do plano não fornecido" });
      }

      await connection.execute(`
        UPDATE training_plans SET
          name = ?, description = ?, short_description = ?,
          base_price = ?, discount_price = ?, is_active = ?,
          stripe_product_id = ?, stripe_price_id = ?,
          version = version + 1
        WHERE id = ?
      `, [
        name,
        description,
        short_description,
        base_price,
        discount_price,
        is_active,
        stripe_product_id,
        stripe_price_id,
        id
      ]);

      connection.release();
      return res.status(200).json({ success: true });
    }

    // DELETE: Excluir plano
    else if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: "ID do plano não fornecido" });
      }

      // Em vez de excluir, apenas desativa o plano
      await connection.execute(
        "UPDATE training_plans SET is_active = 0, status = 'archived' WHERE id = ?",
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
    console.error("❌ Erro na operação de planos:", error);
    return res.status(500).json({ error: "Erro ao processar operação de planos" });
  }
}

// Proteger a rota com CORS e autenticação
export default allowCors(withAuth(handler)); 