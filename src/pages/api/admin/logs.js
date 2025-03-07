import { pool } from '../../../db/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

/**
 * Endpoint para listar logs de auditoria
 * Permite filtrar, paginar e ordenar logs
 */
async function handler(req, res) {
  // Apenas permitir GET para listar logs
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Verificar se é um administrador
  const user = req.user;
  if (!user.isSuperAdmin) {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar logs de auditoria." });
  }

  // Parâmetros de paginação e filtro
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const action = req.query.action;
  const userId = req.query.user_id;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  let connection;
  try {
    connection = await pool.getConnection();
    
    try {
      // Construir a consulta SQL
      let query = `
        SELECT 
          id, user_id, action, method, ip_address, user_agent, 
          details, created_at
        FROM admin_logs
        WHERE 1=1
      `;
      
      const queryParams = [];
      
      // Adicionar filtros
      if (action && action !== 'all') {
        query += ` AND action = ?`;
        queryParams.push(action);
      }
      
      if (userId) {
        query += ` AND user_id = ?`;
        queryParams.push(userId);
      }
      
      if (startDate) {
        query += ` AND created_at >= ?`;
        queryParams.push(startDate);
      }
      
      if (endDate) {
        query += ` AND created_at <= ?`;
        queryParams.push(endDate);
      }
      
      // Ordenar por data decrescente
      query += ` ORDER BY created_at DESC`;
      
      // Adicionar paginação
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limit, offset);
      
      // Executar a consulta
      const [logs] = await connection.execute(query, queryParams);
      
      // Contar o total de logs para a paginação
      let countQuery = `
        SELECT COUNT(*) as total FROM admin_logs WHERE 1=1
      `;
      
      const countParams = [];
      
      if (action && action !== 'all') {
        countQuery += ` AND action = ?`;
        countParams.push(action);
      }
      
      if (userId) {
        countQuery += ` AND user_id = ?`;
        countParams.push(userId);
      }
      
      if (startDate) {
        countQuery += ` AND created_at >= ?`;
        countParams.push(startDate);
      }
      
      if (endDate) {
        countQuery += ` AND created_at <= ?`;
        countParams.push(endDate);
      }
      
      const [countResult] = await connection.execute(countQuery, countParams);
      const total = countResult[0].total;
      
      // Converter detalhes de string JSON para objeto
      const processedLogs = logs.map(log => {
        try {
          if (log.details && typeof log.details === 'string') {
            log.details = JSON.parse(log.details);
          }
        } catch (e) {
          // Se falhar ao analisar, manter o JSON como string
          console.warn(`Erro ao analisar JSON dos detalhes do log ${log.id}:`, e);
        }
        return log;
      });
      
      connection.release();
      
      return res.status(200).json({
        logs: processedLogs,
        pagination: {
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          limit
        }
      });
    } catch (error) {
      // Verificar se a tabela existe
      if (error.code === 'ER_NO_SUCH_TABLE') {
        connection.release();
        return res.status(200).json({
          logs: [],
          pagination: {
            total: 0,
            currentPage: 1,
            totalPages: 0,
            limit
          },
          message: "Tabela de logs ainda não existe"
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (connection) connection.release();
    
    console.error('Erro ao buscar logs de auditoria:', error);
    
    return res.status(500).json({ 
      error: "Erro ao buscar logs de auditoria",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
}

// Aplicar CORS e middleware de autenticação
export default allowCors(withAuth(handler)); 