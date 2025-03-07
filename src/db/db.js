import mysql from 'mysql2/promise';
import config from '../lib/config';

// Verificar se a configuração é válida
if (!config.system.configValid) {
  console.error('❌ ERRO: Configuração do sistema inválida, verificando banco de dados');
  
  // Verificar especificamente configurações do banco de dados
  for (const key of ['host', 'user', 'database']) {
    if (!config.db[key]) {
      console.error(`❌ ERRO: Configuração DB_${key.toUpperCase()} ausente ou inválida`);
    }
  }
}

// Verificação específica do certificado SSL para Aiven
if (process.env.NODE_ENV === 'production' && !config.db.ssl && !process.env.DB_DISABLE_SSL) {
  console.warn('⚠️ AVISO: Conexão sem SSL em produção. Para Aiven, o certificado SSL é recomendado.');
  console.warn('          Verifique se a variável DB_SSL_CA_BASE64 está definida no seu .env');
}

// Log das configurações de conexão (sem mostrar dados sensíveis)
console.log('📊 Configuração de banco de dados:');
console.log(`   - Host: ${config.db.host}`);
console.log(`   - Porta: ${config.db.port}`);
console.log(`   - Banco: ${config.db.database}`);
console.log(`   - SSL: ${config.db.ssl ? 'Configurado ✅' : 'Não configurado ❌'}`);
console.log(`   - Limite de Conexões: ${config.db.connectionLimit}`);

// Criar pool de conexões com configurações validadas
let pool;
try {
  pool = mysql.createPool(config.db);
  console.log('🔄 Pool de conexões criada');
} catch (poolError) {
  console.error('❌ ERRO FATAL: Não foi possível criar o pool de conexões:', poolError.message);
  // Em produção, não lançamos erro para não derrubar a API completamente
  if (process.env.NODE_ENV === 'development') {
    throw poolError;
  }
}

// Testar a conexão inicial
(async function testConnection() {
  if (!pool) {
    console.error('❌ Teste de conexão ignorado: pool não inicializada');
    return;
  }
  
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso!');
    
    // Verificar a versão do MySQL
    const [versionResult] = await connection.query('SELECT VERSION() as version');
    console.log(`🔍 Versão do banco de dados: ${versionResult[0].version}`);
    
    connection.release();
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:');
    console.error(`   - Mensagem: ${error.message}`);
    console.error(`   - Código: ${error.code || 'N/A'}`);
    console.error(`   - Erro: ${error.sqlMessage || 'N/A'}`);
    
    // Orientações específicas para erros comuns
    if (error.code === 'ECONNREFUSED') {
      console.error('   🔍 SUGESTÃO: Verifique se o servidor de banco de dados está em execução e acessível');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   🔍 SUGESTÃO: Credenciais de acesso inválidas. Verifique DB_USER e DB_PASSWORD no seu .env');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   🔍 SUGESTÃO: Banco de dados não existe. Verifique DB_NAME no seu .env');
    } else if (error.code === 'CERT_HAS_EXPIRED') {
      console.error('   🔍 SUGESTÃO: Certificado SSL expirado. Atualize o DB_SSL_CA_BASE64 no seu .env');
    } else if (error.message.includes('ssl')) {
      console.error('   🔍 SUGESTÃO: Problema com SSL. Verifique se o certificado é válido ou desative com DB_DISABLE_SSL=true');
    }
  }
})();

// Função para obter uma conexão da pool
export async function getConnection() {
  if (!pool) {
    console.error('❌ ERRO: Tentativa de obter conexão com pool não inicializada');
    throw new Error('Pool de banco de dados não inicializada');
  }
  
  try {
    return await pool.getConnection();
  } catch (error) {
    console.error('❌ Erro ao obter conexão com o banco de dados:', error.message);
    throw new Error(`Falha ao conectar ao banco de dados: ${error.message}`);
  }
}

// Função para executar uma query com tratamento de erros padronizado
export async function executeQuery(query, params = []) {
  if (!pool) {
    console.error('❌ ERRO: Tentativa de executar query com pool não inicializada');
    throw new Error('Pool de banco de dados não inicializada');
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    console.log(`🔍 Executando query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
    
    const [rows] = await connection.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Erro ao executar query:', error.message);
    console.error('   Query:', query);
    console.error('   Parâmetros:', JSON.stringify(params));
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Função de utilidade para verificar a saúde do banco de dados
export async function checkDatabaseHealth() {
  if (!pool) {
    return { status: 'error', message: 'Pool de conexões não inicializada' };
  }
  
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('SELECT 1 as healthCheck');
    connection.release();
    
    return {
      status: 'ok',
      connected: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      error: error.message,
      code: error.code || 'UNKNOWN',
      timestamp: new Date().toISOString()
    };
  }
}

export { pool };
export default pool;
