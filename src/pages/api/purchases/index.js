import { pool } from '../../../db/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const userId = req.user.id;
  
  // Parâmetros de paginação
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Construir a query para buscar as compras do usuário
    let query = `
      SELECT 
        p.id as purchase_id, 
        p.purchase_date, 
        p.amount_paid,
        p.status,
        p.is_lifetime_access,
        p.access_granted,
        p.access_granted_date,
        tp.id as plan_id,
        tp.name as plan_name,
        tp.short_description as plan_description,
        pv.id as variant_id,
        pv.name as variant_name,
        pv.duration
      FROM purchases p
      JOIN training_plans tp ON p.plan_id = tp.id
      JOIN plan_variants pv ON p.variant_id = pv.id
      WHERE p.user_id = ?
    `;
    
    const queryParams = [userId];
    
    // Adicionar filtro por status se especificado
    if (status && ['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      query += ` AND p.status = ?`;
      queryParams.push(status);
    }
    
    // Adicionar ordenação e paginação
    query += ` ORDER BY p.purchase_date DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    // Executar a query
    const [purchases] = await connection.execute(query, queryParams);
    
    // Obter o total de compras para paginação
    let countQuery = `
      SELECT COUNT(*) as total FROM purchases WHERE user_id = ?
    `;
    
    const countParams = [userId];
    
    if (status && ['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }
    
    const [countResult] = await connection.execute(countQuery, countParams);
    
    // Para cada compra, verificar os materiais disponíveis
    if (purchases.length > 0) {
      for (const purchase of purchases) {
        // Buscar materiais do plano para compras completadas
        if (purchase.status === 'completed' && purchase.access_granted) {
          const [materials] = await connection.execute(`
            SELECT 
              m.id,
              m.title,
              m.description,
              m.file_type,
              uma.first_access_date,
              uma.last_access_date,
              uma.access_count
            FROM plan_materials m
            JOIN user_materials_access uma ON m.id = uma.material_id
            WHERE uma.user_id = ? AND uma.purchase_id = ?
            ORDER BY m.order_sequence ASC
          `, [userId, purchase.purchase_id]);
          
          purchase.materials = materials;
          purchase.materials_count = materials.length;
        }
      }
    }
    
    connection.release();
    
    return res.status(200).json({
      purchases,
      pagination: {
        total: countResult[0].total,
        limit,
        offset
      }
    });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao buscar compras:", error);
    return res.status(500).json({ error: "Erro ao buscar histórico de compras" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 