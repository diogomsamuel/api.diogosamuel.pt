import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { id } = req.query;
  const userId = req.user.id;
  
  if (!id) {
    return res.status(400).json({ error: "ID do material é obrigatório" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Buscar detalhes do material
    const [materialRows] = await connection.execute(`
      SELECT 
        id, plan_id, variant_id, title, description, 
        file_path, file_type, file_size, is_preview
      FROM plan_materials
      WHERE id = ?
    `, [id]);
    
    if (materialRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Material não encontrado" });
    }
    
    const material = materialRows[0];
    
    // Se o material é de prévia, permitir acesso
    if (material.is_preview) {
      connection.release();
      return res.status(200).json({
        success: true,
        material,
        access_type: 'preview'
      });
    }
    
    // Verificar se o usuário tem acesso ao material
    const [accessRows] = await connection.execute(`
      SELECT uma.id, uma.first_access_date, uma.last_access_date, uma.access_count, p.status
      FROM user_materials_access uma
      JOIN purchases p ON uma.purchase_id = p.id
      WHERE uma.user_id = ? AND uma.material_id = ? AND p.status = 'completed' AND p.access_granted = 1
    `, [userId, id]);
    
    if (accessRows.length === 0) {
      connection.release();
      return res.status(403).json({ error: "Acesso não autorizado a este material" });
    }
    
    const access = accessRows[0];
    
    // Atualizar informações de acesso
    await connection.execute(`
      UPDATE user_materials_access
      SET 
        last_access_date = NOW(),
        first_access_date = COALESCE(first_access_date, NOW()),
        access_count = access_count + 1
      WHERE id = ?
    `, [access.id]);
    
    // Buscar informações do plano
    const [planInfo] = await connection.execute(`
      SELECT p.name as plan_name, p.id as plan_id
      FROM training_plans p
      WHERE p.id = ?
    `, [material.plan_id]);
    
    connection.release();
    
    return res.status(200).json({
      success: true,
      material,
      plan: planInfo[0],
      access_info: {
        first_access: access.first_access_date,
        last_access: access.last_access_date,
        access_count: access.access_count + 1
      },
      access_type: 'purchased'
    });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao acessar material:", error);
    return res.status(500).json({ error: "Erro ao acessar material" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 