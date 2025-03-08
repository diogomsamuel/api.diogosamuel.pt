/**
 * Utilitário para conexão com o banco de dados
 * Este arquivo fornece funções para conectar e interagir com o banco de dados MySQL
 */

import mysql from 'mysql2/promise';
import config from './config';

// Cache da conexão para reutilização entre solicitações
let cachedConnection = null;

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
    // Obter configurações do banco de dados
    const dbConfig = {
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      port: config.database.port || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

    // Criar um pool de conexões para melhor gerenciamento
    const pool = mysql.createPool(dbConfig);
    
    // Testar a conexão
    await pool.query('SELECT 1');
    console.log(`[DB] ✅ Conexão com o banco de dados estabelecida: ${config.database.host}:${config.database.port || 3306}/${config.database.name}`);
    
    // Armazenar a conexão no cache
    cachedConnection = pool;
    return pool;
  } catch (error) {
    console.error('[DB] ❌ Erro ao conectar ao banco de dados:', error.message);
    throw new Error(`Falha na conexão com o banco de dados: ${error.message}`);
  }
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
    const db = await connectToDatabase();
    const [results] = await db.execute(sql, params);
    return results;
  } catch (error) {
    console.error('[DB] ❌ Erro na consulta SQL:', error.message);
    console.error('[DB] SQL:', sql);
    console.error('[DB] Parâmetros:', JSON.stringify(params));
    throw error;
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