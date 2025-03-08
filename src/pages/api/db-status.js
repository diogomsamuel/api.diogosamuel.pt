import { connectToDatabase } from "../../lib/db";
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
    // Tentar conectar ao banco de dados
    const startTime = Date.now();
    const pool = await connectToDatabase();
    
    // Executar uma consulta simples para testar a conexão
    const [result] = await pool.query("SELECT 1 as value");
    const endTime = Date.now();
    
    // Calcular tempo de resposta
    const responseTime = endTime - startTime;
    
    // Verificar se a consulta retornou o resultado esperado
    const isConnected = result && result[0]?.value === 1;
    
    if (isConnected) {
      console.log(`[DB STATUS] Banco de dados online (${responseTime}ms)`);
      return res.status(200).json({
        status: "online",
        message: "Conexão com o banco de dados estabelecida com sucesso",
        responseTime: `${responseTime}ms`
      });
    } else {
      console.error("[DB STATUS] Resultado inesperado na verificação");
      return res.status(500).json({
        status: "error",
        message: "Resultado inesperado na verificação do banco de dados"
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