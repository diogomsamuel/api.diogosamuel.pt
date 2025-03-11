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

    // GET: Listar vendas
    if (req.method === "GET") {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const planId = req.query.plan_id;
      const status = req.query.status;
      const startDate = req.query.start_date;
      const endDate = req.query.end_date;

      let query = `
        SELECT 
          p.id, p.purchase_date, p.amount_paid, p.status,
          p.stripe_session_id, p.stripe_payment_intent_id,
          p.is_lifetime_access, p.access_granted,
          u.username as user, u.email as user_email,
          tp.name as plan, pv.name as variant
        FROM purchases p
        JOIN users u ON p.user_id = u.id
        JOIN training_plans tp ON p.plan_id = tp.id
        JOIN plan_variants pv ON p.variant_id = pv.id
        WHERE 1=1
      `;

      const queryParams = [];

      if (planId) {
        query += " AND p.plan_id = ?";
        queryParams.push(planId);
      }

      if (status) {
        query += " AND p.status = ?";
        queryParams.push(status);
      }

      if (startDate && endDate) {
        query += " AND p.purchase_date BETWEEN ? AND ?";
        queryParams.push(startDate, endDate);
      } else if (startDate) {
        query += " AND p.purchase_date >= ?";
        queryParams.push(startDate);
      } else if (endDate) {
        query += " AND p.purchase_date <= ?";
        queryParams.push(endDate);
      }

      query += " ORDER BY p.purchase_date DESC LIMIT ? OFFSET ?";
      queryParams.push(limit, offset);

      const [sales] = await connection.execute(query, queryParams);

      // Contar total de vendas para paginação
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM purchases p
        WHERE 1=1
      `;

      const countParams = [];

      if (planId) {
        countQuery += " AND p.plan_id = ?";
        countParams.push(planId);
      }

      if (status) {
        countQuery += " AND p.status = ?";
        countParams.push(status);
      }

      if (startDate && endDate) {
        countQuery += " AND p.purchase_date BETWEEN ? AND ?";
        countParams.push(startDate, endDate);
      } else if (startDate) {
        countQuery += " AND p.purchase_date >= ?";
        countParams.push(startDate);
      } else if (endDate) {
        countQuery += " AND p.purchase_date <= ?";
        countParams.push(endDate);
      }

      const [countResult] = await connection.execute(countQuery, countParams);

      // Buscar planos para filtro
      const [plans] = await connection.execute(`
        SELECT id, name 
        FROM training_plans 
        WHERE is_active = 1
        ORDER BY name ASC
      `);

      connection.release();
      return res.status(200).json({
        sales,
        plans,
        pagination: {
          total: countResult[0].total,
          limit,
          offset
        }
      });
    }

    // PUT: Atualizar venda
    else if (req.method === "PUT") {
      const { id } = req.query;
      const { status, access_granted } = req.body;

      if (!id) {
        return res.status(400).json({ error: "ID da venda não fornecido" });
      }

      await connection.execute(`
        UPDATE purchases SET 
          status = ?,
          access_granted = ?,
          access_granted_date = CASE 
            WHEN ? = 1 AND access_granted = 0 
            THEN CURRENT_TIMESTAMP 
            ELSE access_granted_date 
          END
        WHERE id = ?
      `, [status, access_granted, access_granted, id]);

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
    console.error("❌ Erro na operação de vendas:", error);
    return res.status(500).json({ error: "Erro ao processar operação de vendas" });
  }
}

// Proteger a rota com CORS e autenticação
export default allowCors(withAuth(handler)); 