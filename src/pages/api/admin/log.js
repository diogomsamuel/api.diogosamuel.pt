import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

/**
 * Endpoint para registrar logs de auditoria de ações administrativas
 * Registra ações como login, logout, modificação de dados, etc.
 */
async function handler(req, res) {
  // Apenas aceitar POST para criar logs
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Verificar autenticação
  const user = req.user;
  if (!user || (!user.id && !user.address)) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  // Obter dados do corpo da requisição
  const { action, method, userId, details = {} } = req.body;

  // Validar dados obrigatórios
  if (!action) {
    return res.status(400).json({ error: "Campo 'action' é obrigatório" });
  }

  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Desconhecido';
  
  // Formatar os detalhes como JSON
  const detailsJson = JSON.stringify(details);
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Registrar o log na tabela admin_logs
    try {
      await connection.execute(
        `INSERT INTO admin_logs (
          user_id, 
          action, 
          method,
          ip_address,
          user_agent,
          details,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId || user.id || user.address,
          action,
          method || 'api',
          ipAddress,
          userAgent,
          detailsJson
        ]
      );
      
      connection.release();
      return res.status(201).json({ success: true });
    } catch (dbError) {
      // Se a tabela não existir, criar automaticamente
      if (dbError.code === 'ER_NO_SUCH_TABLE') {
        try {
          console.log('Criando tabela admin_logs...');
          
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS admin_logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id VARCHAR(255) NOT NULL,
              action VARCHAR(100) NOT NULL,
              method VARCHAR(50) NOT NULL,
              ip_address VARCHAR(45),
              user_agent TEXT,
              details JSON,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `);
          
          // Tentar novamente após criar a tabela
          await connection.execute(
            `INSERT INTO admin_logs (
              user_id, 
              action, 
              method,
              ip_address,
              user_agent,
              details,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              userId || user.id || user.address,
              action,
              method || 'api',
              ipAddress,
              userAgent,
              detailsJson
            ]
          );
          
          connection.release();
          return res.status(201).json({ success: true });
        } catch (createError) {
          console.error('Erro ao criar tabela admin_logs:', createError);
          throw createError;
        }
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    if (connection) connection.release();
    
    console.error('Erro ao registrar log de auditoria:', error);
    
    // Em produção, não expor detalhes do erro
    return res.status(500).json({ 
      error: "Erro ao registrar log de auditoria",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
}

// Aplicar CORS e middleware de autenticação (atenuado para permitir logs de login)
export default allowCors(async (req, res) => {
  // Para logs de login, permitir chamadas sem autenticação
  if (req.method === 'POST' && req.body && req.body.action === 'login') {
    return handler(req, res);
  }
  
  // Para outras ações, exigir autenticação
  return withAuth(handler)(req, res);
}); 