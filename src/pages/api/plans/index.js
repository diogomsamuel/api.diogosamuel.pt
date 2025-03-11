import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Parâmetros de filtro e paginação
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;
  const category = req.query.category;
  const search = req.query.search;
  const sortBy = ['name', 'price', 'newest'].includes(req.query.sort_by) 
    ? req.query.sort_by 
    : 'name';
  
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

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Construir a query base para selecionar planos ativos com prepared statement
    let query = `
      SELECT 
        p.id, p.name, p.description, p.short_description, 
        p.base_price, p.discount_price, p.created_at, p.updated_at,
        p.stripe_product_id, p.stripe_price_id
      FROM training_plans p
      WHERE p.is_active = 1 AND p.status = 'published'
    `;
    
    const queryParams = [];
    
    // Adicionar filtro por categoria se especificado
    if (category) {
      query += `
        AND EXISTS (
          SELECT 1 FROM plan_categories pc 
          JOIN categories c ON pc.category_id = c.id 
          WHERE pc.plan_id = p.id AND (c.id = ? OR c.slug = ?)
        )
      `;
      queryParams.push(category, category);
    }
    
    // Adicionar filtro de busca se especificado
    if (search) {
      query += `
        AND (
          p.name LIKE ? OR 
          p.description LIKE ? OR 
          p.short_description LIKE ?
        )
      `;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Adicionar ordenação com prepared statement
    query += ` ORDER BY `;
    if (sortBy === 'price') {
      query += `COALESCE(p.discount_price, p.base_price)`;
    } else if (sortBy === 'newest') {
      query += `p.created_at DESC`;
    } else {
      query += `p.name`;
    }
    
    // Adicionar paginação com prepared statement
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    console.log('Query:', query);
    console.log('Params:', queryParams);
    
    // Executar a query
    const [plans] = await connection.execute(query, queryParams);
    
    // Buscar as categorias para cada plano
    if (plans.length > 0) {
      const planIds = plans.map(plan => plan.id);
      
      const [planCategories] = await connection.execute(`
        SELECT pc.plan_id, c.id, c.name, c.slug
        FROM plan_categories pc
        JOIN categories c ON pc.category_id = c.id
        WHERE pc.plan_id IN (${planIds.map(() => '?').join(',')})
      `, planIds);
      
      // Adicionar categorias a cada plano
      for (const plan of plans) {
        plan.categories = planCategories
          .filter(cat => cat.plan_id === plan.id)
          .map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug
          }));
      }
      
      // Buscar variantes para cada plano com prepared statement
      const [planVariants] = await connection.execute(`
        SELECT 
          pv.id, pv.plan_id, pv.duration, pv.price,
          pv.training_frequency, pv.experience_level,
          pv.is_active
        FROM plan_variants pv
        WHERE pv.plan_id IN (${planIds.map(() => '?').join(',')}) 
        AND pv.is_active = 1
        ORDER BY pv.price ASC
      `, planIds);
      
      // Adicionar variantes a cada plano
      for (const plan of plans) {
        plan.variants = planVariants
          .filter(variant => variant.plan_id === plan.id)
          .map(variant => ({
            id: variant.id,
            duration: variant.duration,
            price: variant.price,
            training_frequency: variant.training_frequency,
            experience_level: variant.experience_level,
            name: `${variant.training_frequency}x por semana - ${variant.duration} dias`
          }));
      }
      
      // Buscar recursos para cada plano
      const [planFeatures] = await connection.execute(`
        SELECT pf.plan_id, pf.feature, pf.is_highlighted
        FROM plan_features pf
        WHERE pf.plan_id IN (${planIds.map(() => '?').join(',')})
        ORDER BY pf.is_highlighted DESC, pf.id ASC
      `, planIds);
      
      // Adicionar recursos a cada plano
      for (const plan of plans) {
        plan.features = planFeatures
          .filter(feature => feature.plan_id === plan.id)
          .map(feature => ({
            feature: feature.feature,
            is_highlighted: Boolean(feature.is_highlighted)
          }));
      }
    }
    
    // Obter o total de planos para paginação com prepared statement
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM training_plans p
      WHERE p.is_active = 1 AND p.status = 'published'
    `;
    
    let countParams = [];
    
    // Adicionar filtros à query de contagem
    if (category) {
      countQuery += `
        AND EXISTS (
          SELECT 1 FROM plan_categories pc 
          JOIN categories c ON pc.category_id = c.id 
          WHERE pc.plan_id = p.id AND (c.id = ? OR c.slug = ?)
        )
      `;
      countParams.push(category, category);
    }
    
    if (search) {
      countQuery += `
        AND (
          p.name LIKE ? OR 
          p.description LIKE ? OR 
          p.short_description LIKE ?
        )
      `;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    const [countResult] = await connection.execute(countQuery, countParams);
    
    // Buscar todas as categorias disponíveis
    const [categories] = await connection.execute(`
      SELECT c.id, c.name, c.slug, COUNT(pc.plan_id) as plan_count
      FROM categories c
      LEFT JOIN plan_categories pc ON c.id = pc.category_id
      LEFT JOIN training_plans p ON pc.plan_id = p.id AND p.is_active = 1
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    
    connection.release();
    
    return res.status(200).json({
      success: true,
      plans,
      categories: categories.map(cat => ({
        ...cat,
        plan_count: Number(cat.plan_count)
      })),
      pagination: {
        total: Number(countResult[0].total),
        limit: Number(limit),
        offset: Number(offset),
        pages: Math.ceil(Number(countResult[0].total) / limit)
      }
    });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao buscar planos:", error);
    return res.status(500).json({ 
      success: false,
      error: "Erro ao buscar planos de treinamento",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
}

// Aplicar CORS
export default allowCors(handler); 