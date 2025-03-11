/**
 * Utilitário para conexão com o banco de dados Aiven
 * Este arquivo fornece funções para conectar e interagir com o banco de dados MySQL
 */

import mysql from 'mysql2/promise';

// Criar pool de conexões
const pool = mysql.createPool({
  host: process.env.DB_HOSTNAME,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // 10 segundos de timeout
  ssl: {
    ca: Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf-8'), // Decodifica o certificado
  },
});

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
  try {
    await pool.query('SELECT 1');
    return {
      connected: true,
      status: 'online'
    };
  } catch (error) {
    return {
      connected: false,
      status: 'offline',
      error: error.message,
      code: error.code
    };
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