import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  // Verificar se o usuário é administrador
  if (!req.user || req.user.walletAddress !== process.env.ADMIN_WALLET) {
    return res.status(403).json({ 
      success: false,
      error: "Acesso não autorizado",
      message: "Você não tem permissão para acessar este recurso"
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // GET: Listar planos
    if (req.method === "GET") {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const search = req.query.search;

      // Validar parâmetros
      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: "Limite inválido",
          message: "O limite deve estar entre 1 e 100"
        });
      }

      if (offset < 0) {
        return res.status(400).json({
          success: false,
          error: "Offset inválido",
          message: "O offset não pode ser negativo"
        });
      }

      let query = `
        SELECT 
          p.id, p.name, p.description, p.short_description,
          p.base_price, p.discount_price, p.is_active,
          p.created_at, p.updated_at, p.version, p.status,
          p.stripe_product_id, p.stripe_price_id,
          COUNT(DISTINCT pv.id) as variants_count,
          COUNT(DISTINCT pu.id) as sales_count,
          SUM(CASE WHEN pu.status = 'completed' THEN pu.amount ELSE 0 END) as total_revenue
        FROM training_plans p
        LEFT JOIN plan_variants pv ON p.id = pv.plan_id
        LEFT JOIN purchases pu ON p.id = pu.plan_id
      `;

      const queryParams = [];

      if (search) {
        query += `
          WHERE (p.name LIKE ? OR p.description LIKE ? OR 
          p.short_description LIKE ?)
        `;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
      queryParams.push(limit, offset);

      console.log('Query:', query);
      console.log('Params:', queryParams);

      const [plans] = await connection.execute(query, queryParams);

      // Contar total de planos para paginação
      let countQuery = "SELECT COUNT(*) as total FROM training_plans";
      if (search) {
        countQuery += ` WHERE name LIKE ? OR description LIKE ? OR short_description LIKE ?`;
      }

      const [countResult] = await connection.execute(
        countQuery,
        search ? Array(3).fill(`%${search}%`) : []
      );

      // Buscar variantes para cada plano
      if (plans.length > 0) {
        const planIds = plans.map(plan => plan.id);
        
        const [variants] = await connection.execute(`
          SELECT 
            pv.id, pv.plan_id, pv.duration, pv.price,
            pv.training_frequency, pv.experience_level,
            pv.is_active, COUNT(pu.id) as sales_count
          FROM plan_variants pv
          LEFT JOIN purchases pu ON pv.id = pu.variant_id AND pu.status = 'completed'
          WHERE pv.plan_id IN (${planIds.map(() => '?').join(',')})
          GROUP BY pv.id
          ORDER BY pv.price ASC
        `, planIds);

        // Adicionar variantes a cada plano
        for (const plan of plans) {
          plan.variants = variants
            .filter(v => v.plan_id === plan.id)
            .map(v => ({
              id: v.id,
              duration: v.duration,
              price: v.price,
              training_frequency: v.training_frequency,
              experience_level: v.experience_level,
              is_active: Boolean(v.is_active),
              sales_count: Number(v.sales_count),
              name: `${v.training_frequency}x por semana - ${v.duration} dias`
            }));
        }
      }

      connection.release();
      return res.status(200).json({
        success: true,
        plans: plans.map(plan => ({
          ...plan,
          variants_count: Number(plan.variants_count),
          sales_count: Number(plan.sales_count),
          total_revenue: Number(plan.total_revenue || 0),
          is_active: Boolean(plan.is_active)
        })),
        pagination: {
          total: Number(countResult[0].total),
          limit: Number(limit),
          offset: Number(offset),
          pages: Math.ceil(Number(countResult[0].total) / limit)
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

      // Validar campos obrigatórios
      if (!name || !description || !base_price) {
        return res.status(400).json({
          success: false,
          error: "Campos obrigatórios ausentes",
          message: "Nome, descrição e preço base são obrigatórios"
        });
      }

      // Validar preços
      if (isNaN(base_price) || base_price < 0) {
        return res.status(400).json({
          success: false,
          error: "Preço base inválido",
          message: "O preço base deve ser um número positivo"
        });
      }

      if (discount_price !== null && (isNaN(discount_price) || discount_price < 0)) {
        return res.status(400).json({
          success: false,
          error: "Preço com desconto inválido",
          message: "O preço com desconto deve ser um número positivo"
        });
      }

      // Ensure all parameters have a value (null is valid for SQL)
      const safeParams = [
        name,
        description,
        short_description || '',
        Number(base_price),
        discount_price ? Number(discount_price) : null,
        stripe_product_id || null,
        stripe_price_id || null
      ];

      const [result] = await connection.execute(`
        INSERT INTO training_plans (
          name, description, short_description, base_price,
          discount_price, stripe_product_id, stripe_price_id,
          is_active, status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'published', 1)
      `, safeParams);

      connection.release();
      return res.status(201).json({
        success: true,
        plan_id: result.insertId
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
        return res.status(400).json({
          success: false,
          error: "ID não fornecido",
          message: "O ID do plano é obrigatório"
        });
      }

      // Validar campos obrigatórios
      if (!name || !description || base_price === undefined) {
        return res.status(400).json({
          success: false,
          error: "Campos obrigatórios ausentes",
          message: "Nome, descrição e preço base são obrigatórios"
        });
      }

      // Validar preços
      if (isNaN(base_price) || base_price < 0) {
        return res.status(400).json({
          success: false,
          error: "Preço base inválido",
          message: "O preço base deve ser um número positivo"
        });
      }

      if (discount_price !== null && (isNaN(discount_price) || discount_price < 0)) {
        return res.status(400).json({
          success: false,
          error: "Preço com desconto inválido",
          message: "O preço com desconto deve ser um número positivo"
        });
      }

      // Ensure all parameters have a value (null is valid for SQL)
      const safeParams = [
        name,
        description,
        short_description || '',
        Number(base_price),
        discount_price ? Number(discount_price) : null,
        Boolean(is_active),
        stripe_product_id || null,
        stripe_price_id || null,
        id
      ];

      const [result] = await connection.execute(`
        UPDATE training_plans SET
          name = ?, description = ?, short_description = ?,
          base_price = ?, discount_price = ?, is_active = ?,
          stripe_product_id = ?, stripe_price_id = ?,
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, safeParams);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: "Plano não encontrado",
          message: "O plano especificado não existe"
        });
      }

      connection.release();
      return res.status(200).json({ success: true });
    }

    // DELETE: Excluir plano
    else if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "ID não fornecido",
          message: "O ID do plano é obrigatório"
        });
      }

      // Verificar se existem compras associadas
      const [purchases] = await connection.execute(
        "SELECT COUNT(*) as count FROM purchases WHERE plan_id = ?",
        [id]
      );

      if (purchases[0].count > 0) {
        // Em vez de excluir, apenas desativa o plano
        await connection.execute(`
          UPDATE training_plans SET 
            is_active = 0, 
            status = 'archived',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [id]);
      } else {
        // Se não houver compras, pode excluir
        await connection.execute(
          "DELETE FROM training_plans WHERE id = ?",
          [id]
        );
      }

      connection.release();
      return res.status(200).json({ success: true });
    }

    // Método não permitido
    else {
      connection.release();
      return res.status(405).json({ 
        success: false,
        error: "Método não permitido",
        message: "Este método não é suportado neste endpoint"
      });
    }

  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro na operação de planos:", error);
    return res.status(500).json({ 
      success: false,
      error: "Erro ao processar operação",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
}

// Proteger a rota com CORS e autenticação
export default allowCors(withAuth(handler)); 