import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Verifica se o usuário está autenticado corretamente
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Usuário não autenticado corretamente" });
  }

  const userId = req.user.id;
  
  // Parâmetros de paginação
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Verificamos primeiro se o usuário existe
    try {
      const [userExists] = await connection.execute(
        "SELECT id FROM users WHERE id = ?", 
        [userId]
      );
      
      if (userExists.length === 0) {
        connection.release();
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Primeiro, vamos verificar a estrutura da tabela plan_variants
      try {
        // Construir a query para buscar as compras do usuário, sem assumir a coluna name
        try {
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
              pv.training_frequency,
              pv.experience_level
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
          query += ` ORDER BY p.purchase_date DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
          
          // Executar a query
          const [purchases] = await connection.execute(query, queryParams);
          
          // Adicionar um título genérico para a variante baseado na frequência e nível
          for (const purchase of purchases) {
            purchase.variant_name = `${purchase.training_frequency}x por semana - Nível ${purchase.experience_level}`;
          }
          
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
                try {
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
                } catch (materialError) {
                  console.warn("Aviso: Erro ao buscar materiais da compra:", materialError.message);
                  purchase.materials = [];
                  purchase.materials_count = 0;
                }
              } else {
                purchase.materials = [];
                purchase.materials_count = 0;
              }
            }
          }
          
          connection.release();
          
          return res.status(200).json({
            success: true,
            purchases,
            pagination: {
              total: countResult[0].total,
              limit,
              offset
            }
          });
        } catch (purchaseError) {
          // Se houver erro na consulta das compras
          console.warn("Aviso: Erro na consulta de compras:", purchaseError.message);
          
          // Se for um erro na tabela
          if (purchaseError.code === 'ER_NO_SUCH_TABLE') {
            connection.release();
            return res.status(200).json({
              success: true,
              purchases: [],
              pagination: {
                total: 0,
                limit,
                offset
              },
              message: "Nenhum histórico de compras disponível"
            });
          }
          
          throw purchaseError; // Propagar para o catch externo
        }
      } catch (error) {
        throw error; // Propagar erro
      }
    } catch (userError) {
      // Se houver erro na consulta do usuário
      console.error("Erro ao verificar existência do usuário:", userError);
      
      if (userError.code === 'ER_NO_SUCH_TABLE') {
        connection.release();
        return res.status(500).json({
          success: false,
          error: "Erro no sistema",
          message: "A estrutura do banco de dados não está configurada corretamente"
        });
      }
      
      throw userError; // Propagar para o catch externo
    }
  } catch (error) {
    if (connection) connection.release();
    
    console.error("Erro ao buscar compras:", error);
    
    // Mensagens de erro mais específicas
    if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({ 
        success: false,
        error: "Erro de conexão",
        message: "Não foi possível conectar ao banco de dados" 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: "Erro ao buscar histórico de compras",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação" 
    });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 