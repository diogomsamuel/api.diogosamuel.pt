import pool from "../../../lib/db";
import { allowCors } from "../../../lib/cors";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: "ID do plano é obrigatório" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Buscar dados básicos do plano
    const [planRows] = await connection.execute(`
      SELECT 
        id, name, description, short_description,
        base_price, discount_price, is_active, status, created_at, updated_at
      FROM training_plans
      WHERE id = ? AND is_active = 1 AND status = 'published'
    `, [id]);
    
    if (planRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Plano não encontrado" });
    }
    
    const plan = planRows[0];
    
    // Buscar categorias do plano
    const [categories] = await connection.execute(`
      SELECT c.id, c.name, c.slug
      FROM categories c
      JOIN plan_categories pc ON c.id = pc.category_id
      WHERE pc.plan_id = ?
    `, [id]);
    
    plan.categories = categories;
    
    // Buscar variantes do plano
    const [variants] = await connection.execute(`
      SELECT 
        id, name, description, price, duration, is_active
      FROM plan_variants
      WHERE plan_id = ? AND is_active = 1
      ORDER BY price ASC
    `, [id]);
    
    plan.variants = variants;
    
    // Buscar recursos do plano
    const [features] = await connection.execute(`
      SELECT feature, is_highlighted
      FROM plan_features
      WHERE plan_id = ?
      ORDER BY is_highlighted DESC, id ASC
    `, [id]);
    
    plan.features = features.map(feature => ({
      feature: feature.feature,
      is_highlighted: !!feature.is_highlighted
    }));
    
    // Buscar materiais de prévia do plano (se existirem)
    const [previewMaterials] = await connection.execute(`
      SELECT 
        id, title, description, file_path, file_type, file_size
      FROM plan_materials
      WHERE plan_id = ? AND is_preview = 1
      ORDER BY order_sequence ASC
    `, [id]);
    
    plan.preview_materials = previewMaterials;
    
    // Buscar avaliações do plano
    const [reviews] = await connection.execute(`
      SELECT 
        pr.id, pr.rating, pr.review_text, pr.created_at,
        u.display_name, u.username
      FROM plan_reviews pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.plan_id = ? AND pr.is_published = 1
      ORDER BY pr.created_at DESC
      LIMIT 10
    `, [id]);
    
    plan.reviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      review_text: review.review_text,
      created_at: review.created_at,
      user: {
        name: review.display_name || review.username
      }
    }));
    
    // Calcular a média das avaliações
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      plan.average_rating = totalRating / reviews.length;
      plan.reviews_count = reviews.length;
    } else {
      plan.average_rating = null;
      plan.reviews_count = 0;
    }
    
    // Buscar planos relacionados da mesma categoria
    const [relatedPlans] = await connection.execute(`
      SELECT DISTINCT 
        p.id, p.name, p.short_description, p.base_price, p.discount_price
      FROM training_plans p
      JOIN plan_categories pc1 ON p.id = pc1.plan_id
      JOIN plan_categories pc2 ON pc1.category_id = pc2.category_id
      WHERE 
        pc2.plan_id = ? 
        AND p.id != ? 
        AND p.is_active = 1 
        AND p.status = 'published'
      LIMIT 4
    `, [id, id]);
    
    plan.related_plans = relatedPlans;
    
    connection.release();
    
    return res.status(200).json(plan);
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao buscar detalhes do plano:", error);
    return res.status(500).json({ error: "Erro ao buscar detalhes do plano" });
  }
}

// Aplicar CORS
export default allowCors(handler); 