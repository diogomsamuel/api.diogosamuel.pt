import { connectToDatabase, checkDatabaseHealth } from "../../lib/db";
import { allowCors } from "../../lib/cors";

/**
 * Endpoint para verificar o status do banco de dados
 * Utilizado por ferramentas de monitoramento e pelo painel de admin
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
async function handler(req, res) {
  // Apenas permitir requisições GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  console.log("[DB STATUS] Verificando status do banco de dados");
  
  try {
    // Verificar saúde do banco de dados
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.connected) {
      console.log(`[DB STATUS] Banco de dados online`);
      return res.status(200).json({
        status: "online",
        message: "Conexão com o banco de dados estabelecida com sucesso"
      });
    } else {
      console.error(`[DB STATUS] Banco de dados offline: ${dbHealth.error}`);
      return res.status(503).json({
        status: "offline",
        message: "Não foi possível conectar ao banco de dados",
        error: dbHealth.error
      });
    }
  } catch (error) {
    console.error("[DB STATUS] Erro ao verificar status do banco de dados:", error);
    
    return res.status(503).json({
      status: "offline",
      message: "Não foi possível conectar ao banco de dados",
      error: error.message
    });
  }
}

// Aplicar middleware CORS
export default allowCors(handler); 