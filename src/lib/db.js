/**
 * Utilitário para conexão com o banco de dados Aiven
 * Este arquivo fornece funções para conectar e interagir com o banco de dados MySQL
 */

import mysql from 'mysql2/promise';

// Criar um pool de conexões
const pool = mysql.createPool({
  host: process.env.DB_HOSTNAME,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: 0,
  connectTimeout: 10000, // 10 segundos de timeout
  ssl: {
    ca: Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf-8'), // Decodifica o certificado
  },
});

// Verificar a conexão ao iniciar
(async () => {
  try {
    console.log('[DB] Testando conexão com o banco de dados...');
    const connection = await pool.getConnection();
    console.log('[DB] ✅ Conexão com o banco de dados estabelecida com sucesso!');
    console.log('[DB] Informações da conexão:', {
      host: process.env.DB_HOSTNAME,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      ssl: process.env.DB_SSL_CA_BASE64 ? 'Configurado' : 'Não configurado'
    });
    connection.release();
  } catch (error) {
    console.error('[DB] ❌ Erro ao conectar com o banco de dados:', error.message);
    console.error('[DB] Stack trace:', error.stack);
    console.error('[DB] Detalhes da configuração (sem senha):', {
      host: process.env.DB_HOSTNAME,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      ssl: process.env.DB_SSL_CA_BASE64 ? 'Configurado' : 'Não configurado'
    });
  }
})();

// Cache da conexão para reutilização entre solicitações
let cachedConnection = pool;

/**
 * Conecta ao banco de dados MySQL e retorna um pool de conexões
 * Reutiliza conexões existentes quando possível
 * 
 * @returns {Promise<mysql.Pool>} Pool de conexões com o banco de dados
 */
export async function connectToDatabase() {
  // Se já temos uma conexão, reutilizá-la
  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    // Testar a conexão
    await pool.query('SELECT 1');
    console.log(`[DB] ✅ Conexão com o banco de dados estabelecida: ${process.env.DB_HOSTNAME}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    // Armazenar a conexão no cache
    cachedConnection = pool;
    return pool;
  } catch (error) {
    console.error('[DB] ❌ Erro ao conectar ao banco de dados:', error.message);
    throw new Error(`Falha na conexão com o banco de dados Aiven: ${error.message}`);
  }
}

/**
 * Função para obter uma conexão da pool
 * @returns {Promise<mysql.PoolConnection>} Uma conexão do pool
 */
export async function getConnection() {
  return await pool.getConnection();
}

/**
 * Executa uma consulta SQL no banco de dados com parâmetros
 * 
 * @param {string} sql - Consulta SQL com placeholders
 * @param {Array} params - Parâmetros para a consulta SQL
 * @returns {Promise<Array>} Resultados da consulta
 */
export async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('[DB] ❌ Erro na consulta SQL:', error.message);
    console.error('[DB] SQL:', sql);
    console.error('[DB] Parâmetros:', JSON.stringify(params));
    throw error;
  }
}

/**
 * Verifica a saúde do banco de dados
 * @returns {Promise<Object>} Status da conexão
 */
export async function checkDatabaseHealth() {
  let connection;
  try {
    console.log('[DB HEALTH] Iniciando verificação de saúde do banco de dados...');
    console.log('[DB HEALTH] Configurações:', {
      host: process.env.DB_HOSTNAME,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      ssl: process.env.DB_SSL_CA_BASE64 ? 'Configurado' : 'Não configurado'
    });

    connection = await pool.getConnection();
    console.log('[DB HEALTH] Conexão obtida com sucesso');

    const [result] = await connection.query('SELECT 1 as healthCheck');
    console.log('[DB HEALTH] Query executada com sucesso:', result);

    return {
      connected: true,
      status: 'online',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[DB HEALTH] Erro ao verificar saúde do banco de dados:', error.message);
    console.error('[DB HEALTH] Stack trace:', error.stack);
    
    return {
      connected: false,
      status: 'offline',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    };
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('[DB HEALTH] Conexão liberada');
      } catch (releaseError) {
        console.error('[DB HEALTH] Erro ao liberar conexão:', releaseError.message);
      }
    }
  }
}

/**
 * Fecha a conexão com o banco de dados
 * Útil ao encerrar o aplicativo
 */
export async function closeConnection() {
  if (cachedConnection) {
    try {
      await cachedConnection.end();
      console.log('[DB] Conexão com o banco de dados fechada');
      cachedConnection = null;
    } catch (error) {
      console.error('[DB] Erro ao fechar conexão:', error.message);
    }
  }
}

export default pool; 