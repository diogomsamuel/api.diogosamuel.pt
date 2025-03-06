import { pool } from '../../../db/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const userId = req.user.id;
  
  // Parâmetros de filtro e paginação
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const plan_id = req.query.plan_id;
  const file_type = req.query.file_type;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Construir a query para buscar materiais que o usuário tem acesso
    let query = `
      SELECT 
        m.id, m.plan_id, m.title, m.description, 
        m.file_path, m.file_type, m.file_size, m.is_preview,
        p.name as plan_name,
        uma.first_access_date, uma.last_access_date, uma.access_count
      FROM plan_materials m
      JOIN training_plans p ON m.plan_id = p.id
      JOIN user_materials_access uma ON m.id = uma.material_id
      JOIN purchases pu ON uma.purchase_id = pu.id
      WHERE uma.user_id = ? AND pu.status = 'completed' AND pu.access_granted = 1
    `;
    
    const queryParams = [userId];
    
    // Adicionar filtro por plano se especificado
    if (plan_id) {
      query += ` AND m.plan_id = ?`;
      queryParams.push(plan_id);
    }
    
    // Adicionar filtro por tipo de arquivo se especificado
    if (file_type && ['pdf', 'video', 'image', 'excel', 'word', 'other'].includes(file_type)) {
      query += ` AND m.file_type = ?`;
      queryParams.push(file_type);
    }
    
    // Adicionar ordenação e paginação
    query += ` ORDER BY p.name ASC, m.order_sequence ASC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    // Executar a query
    const [materials] = await connection.execute(query, queryParams);
    
    // Também buscar materiais de prévia disponíveis para todos
    const [previewMaterials] = await connection.execute(`
      SELECT 
        m.id, m.plan_id, m.title, m.description, 
        m.file_path, m.file_type, m.file_size, m.is_preview,
        p.name as plan_name
      FROM plan_materials m
      JOIN training_plans p ON m.plan_id = p.id
      WHERE m.is_preview = 1 AND p.is_active = 1 AND p.status = 'published'
        AND m.id NOT IN (
          SELECT material_id FROM user_materials_access WHERE user_id = ?
        )
    `, [userId]);
    
    // Adicionar flag de prévia aos materiais
    previewMaterials.forEach(material => {
      material.is_preview = true;
      material.access_type = 'preview';
    });
    
    // Adicionar flag de acesso completo aos materiais comprados
    materials.forEach(material => {
      material.access_type = 'purchased';
    });
    
    // Combinar os dois conjuntos de materiais
    const allMaterials = [...materials, ...previewMaterials];
    
    // Obter o total de materiais para paginação (apenas os que tem acesso)
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM plan_materials m
      JOIN user_materials_access uma ON m.id = uma.material_id
      JOIN purchases pu ON uma.purchase_id = pu.id
      WHERE uma.user_id = ? AND pu.status = 'completed' AND pu.access_granted = 1
    `;
    
    const countParams = [userId];
    
    if (plan_id) {
      countQuery += ` AND m.plan_id = ?`;
      countParams.push(plan_id);
    }
    
    if (file_type && ['pdf', 'video', 'image', 'excel', 'word', 'other'].includes(file_type)) {
      countQuery += ` AND m.file_type = ?`;
      countParams.push(file_type);
    }
    
    const [countResult] = await connection.execute(countQuery, countParams);
    
    // Buscar o total de materiais de prévia
    const [previewCountResult] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM plan_materials m
      JOIN training_plans p ON m.plan_id = p.id
      WHERE m.is_preview = 1 AND p.is_active = 1 AND p.status = 'published'
        AND m.id NOT IN (
          SELECT material_id FROM user_materials_access WHERE user_id = ?
        )
    `, [userId]);
    
    // Buscar planos que o usuário tem acesso para filtro
    const [userPlans] = await connection.execute(`
      SELECT DISTINCT 
        p.id, p.name
      FROM training_plans p
      JOIN purchases pu ON p.id = pu.plan_id
      WHERE pu.user_id = ? AND pu.status = 'completed' AND pu.access_granted = 1
      ORDER BY p.name ASC
    `, [userId]);
    
    connection.release();
    
    return res.status(200).json({
      materials: allMaterials,
      user_plans: userPlans,
      pagination: {
        total_purchased: countResult[0].total,
        total_preview: previewCountResult[0].total,
        total: countResult[0].total + previewCountResult[0].total,
        limit,
        offset
      }
    });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao buscar materiais:", error);
    return res.status(500).json({ error: "Erro ao buscar materiais disponíveis" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 