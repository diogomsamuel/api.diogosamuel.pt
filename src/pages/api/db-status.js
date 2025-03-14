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
  // Configuração de CORS usando variáveis de ambiente
  const origin = req.headers.origin || '';
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS_REMOTE
    ? process.env.CORS_ALLOWED_ORIGINS_REMOTE.split(",")
    : [];

  // Log para depuração
  console.log("[DB STATUS] Origin:", origin);
  console.log("[DB STATUS] Allowed Origins from env:", allowedOrigins);

  // Se a origem estiver na lista de permitidas, defina o cabeçalho CORS
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, Cookie, Set-Cookie');
  }

  // Responder imediatamente a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

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
        success: true,
        status: "connected",
        message: "Conexão com o banco de dados estabelecida com sucesso",
        timestamp: new Date().toISOString(),
        stats: dbHealth.stats || { connectionLimit: 10, status: "Pool statistics not available" }
      });
    } else {
      console.error(`[DB STATUS] Banco de dados offline: ${dbHealth.error}`);
      return res.status(503).json({
        success: false,
        status: "disconnected",
        message: "Não foi possível conectar ao banco de dados",
        timestamp: new Date().toISOString(),
        error: dbHealth.error
      });
    }
  } catch (error) {
    console.error("[DB STATUS] Erro ao verificar status do banco de dados:", error);
    
    return res.status(503).json({
      success: false,
      status: "error",
      message: "Erro ao verificar status do banco de dados",
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

// Podemos usar também o middleware allowCors que já faz isso corretamente
export default allowCors(handler); 