import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

/**
 * Endpoint para executar ações administrativas especiais
 * Apenas o super administrador pode executar estas ações
 * 
 * Ações suportadas:
 * - clear_logs: Limpar logs antigos
 * - check_database: Verificar integridade do banco
 * - create_backup: Criar backup do sistema
 */
async function handler(req, res) {
  // Apenas aceitar POST para executar ações
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Extrair dados da requisição
  const { action, parameters = {}, walletAddress } = req.body;
  const user = req.user;
  
  // Validar ação solicitada
  if (!action) {
    return res.status(400).json({ error: "Campo 'action' é obrigatório" });
  }
  
  // Validar permissões de Super Admin
  const adminWallet = process.env.ADMIN_WALLET;
  const isSuperAdmin = adminWallet && walletAddress && 
    walletAddress.toLowerCase() === adminWallet.toLowerCase();
  
  if (!isSuperAdmin) {
    await logAdminAction({
      userId: user.id || 'unknown',
      action: 'unauthorized_admin_action',
      details: {
        walletAddress,
        requestedAction: action,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      }
    });
    
    return res.status(403).json({ 
      error: "Acesso negado",
      message: "Apenas o super administrador pode executar esta ação" 
    });
  }

  // Lista de ações permitidas
  const allowedActions = {
    'clear_logs': clearLogs,
    'check_database': checkDatabase,
    'create_backup': createBackup
  };
  
  // Verificar se a ação é permitida
  if (!Object.keys(allowedActions).includes(action)) {
    return res.status(400).json({ error: `Ação '${action}' não reconhecida` });
  }
  
  try {
    // Registrar a ação
    await logAdminAction({
      userId: user.id || walletAddress,
      action: `admin_${action}`,
      details: {
        parameters,
        walletAddress,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      }
    });
    
    // Executar a ação solicitada
    const result = await allowedActions[action](parameters);
    
    return res.status(200).json({
      success: true,
      action,
      result
    });
  } catch (error) {
    console.error(`Erro ao executar ação '${action}':`, error);
    
    // Registrar erro
    await logAdminAction({
      userId: user.id || walletAddress,
      action: `admin_${action}_error`,
      details: {
        error: error.message,
        parameters,
        walletAddress
      }
    });
    
    return res.status(500).json({ 
      error: `Erro ao executar ação '${action}'`,
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
}

/**
 * Registra uma ação administrativa no log
 */
async function logAdminAction(data) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute(
      `INSERT INTO admin_logs (
        user_id, action, method, ip_address, details, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        data.userId,
        data.action,
        'admin_api',
        data.details.ip || '',
        JSON.stringify(data.details)
      ]
    );
  } catch (error) {
    console.error('Erro ao registrar ação no log:', error);
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Limpa logs antigos do sistema
 */
async function clearLogs(params) {
  const daysToKeep = params.daysToKeep || 30;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      `DELETE FROM admin_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [daysToKeep]
    );
    
    return {
      deletedCount: result.affectedRows,
      daysKept: daysToKeep
    };
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Verifica a integridade do banco de dados
 */
async function checkDatabase() {
  let connection;
  const tables = ['users', 'user_profiles', 'purchases', 'admin_logs'];
  const results = {};
  
  try {
    connection = await pool.getConnection();
    
    for (const table of tables) {
      try {
        const [checkResult] = await connection.execute(`CHECK TABLE ${table}`);
        results[table] = checkResult[0].Msg_text === 'OK' ? 'OK' : 'Problemas encontrados';
      } catch (tableError) {
        results[table] = `Erro: ${tableError.message}`;
      }
    }
    
    return {
      tables: results,
      timestamp: new Date().toISOString()
    };
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Cria um backup do banco de dados (simulado)
 */
async function createBackup() {
  // Em produção, implementar lógica real de backup
  return {
    backupId: `backup_${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'Backup simulado criado com sucesso',
    note: 'Em produção, implementar a lógica real de backup'
  };
}

// Aplicar CORS e middleware de autenticação
export default allowCors(withAuth(handler)); 