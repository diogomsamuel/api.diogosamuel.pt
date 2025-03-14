import { checkDatabaseHealth } from "../../lib/db";
import { allowCors } from "../../lib/cors";

/**
 * Endpoint para verificar o status do banco de dados
 * Utilizado por ferramentas de monitoramento e pelo painel de admin
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
async function handler(req, res) {
  // Log para depuração
  console.log("[DB STATUS] Iniciando verificação de status");
  console.log("[DB STATUS] Método:", req.method);
  console.log("[DB STATUS] Origin:", req.headers.origin);

  // Apenas permitir requisições GET
  if (req.method !== "GET") {
    console.log("[DB STATUS] Método não permitido:", req.method);
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    // Verificar saúde do banco de dados
    console.log("[DB STATUS] Chamando checkDatabaseHealth");
    const dbHealth = await checkDatabaseHealth();
    console.log("[DB STATUS] Resultado:", dbHealth);
    
    if (dbHealth.connected) {
      console.log("[DB STATUS] Banco de dados online");
      return res.status(200).json({
        success: true,
        status: "connected",
        message: "Conexão com o banco de dados estabelecida com sucesso",
        timestamp: dbHealth.timestamp,
        stats: {
          connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
          status: "Pool statistics not available"
        }
      });
    } else {
      console.error("[DB STATUS] Banco de dados offline:", dbHealth.error);
      return res.status(503).json({
        success: false,
        status: "disconnected",
        message: "Não foi possível conectar ao banco de dados",
        timestamp: dbHealth.timestamp,
        error: dbHealth.error,
        code: dbHealth.code
      });
    }
  } catch (error) {
    console.error("[DB STATUS] Erro ao verificar status do banco de dados:", error);
    
    return res.status(503).json({
      success: false,
      status: "error",
      message: "Erro ao verificar status do banco de dados",
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Usar o middleware allowCors que já faz isso corretamente
export default allowCors(handler); 