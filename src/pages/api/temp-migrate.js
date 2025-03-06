import pool from "../../lib/db";

// Este é um endpoint temporário para executar a migração do banco de dados
// IMPORTANTE: Remova este arquivo após usar!
export default async function handler(req, res) {
  // Adicionar um token simples para prevenir acesso não autorizado
  const tempToken = "migrate123456";
  
  if (req.query.token !== tempToken) {
    return res.status(403).json({ error: "Token inválido" });
  }
  
  console.log("🔄 Iniciando migração de campos do Stripe...");
  let connection;
  
  try {
    connection = await pool.getConnection();
    const results = { added: [], existed: [], errors: [] };
    
    // 1. Adicionar campo stripe_customer_id à tabela users
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL
      `);
      results.added.push("stripe_customer_id em users");
    } catch (error) {
      // Provavelmente a coluna já existe
      results.existed.push("stripe_customer_id em users");
      console.log(`Coluna provavelmente já existe: ${error.message}`);
    }
    
    // 2. Adicionar stripe_session_id à tabela purchases
    try {
      await connection.execute(`
        ALTER TABLE purchases
        ADD COLUMN stripe_session_id VARCHAR(255) DEFAULT NULL
      `);
      results.added.push("stripe_session_id em purchases");
    } catch (error) {
      results.existed.push("stripe_session_id em purchases");
      console.log(`Coluna provavelmente já existe: ${error.message}`);
    }
    
    // 3. Adicionar stripe_payment_intent_id à tabela purchases
    try {
      await connection.execute(`
        ALTER TABLE purchases
        ADD COLUMN stripe_payment_intent_id VARCHAR(255) DEFAULT NULL
      `);
      results.added.push("stripe_payment_intent_id em purchases");
    } catch (error) {
      results.existed.push("stripe_payment_intent_id em purchases");
      console.log(`Coluna provavelmente já existe: ${error.message}`);
    }
    
    // Adicionar índices se as colunas forem adicionadas com sucesso
    try {
      // Verificar se a coluna existe antes de adicionar o índice
      const [columnsCustomer] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'stripe_customer_id'
      `);
      
      if (columnsCustomer.length > 0) {
        try {
          await connection.execute(`
            CREATE INDEX idx_stripe_customer ON users (stripe_customer_id)
          `);
          results.added.push("Índice idx_stripe_customer");
        } catch (error) {
          // Índice provavelmente já existe
          results.existed.push("Índice idx_stripe_customer");
        }
      }
      
      // Verificar colunas em purchases antes de adicionar os índices
      const [columnsSession] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'stripe_session_id'
      `);
      
      if (columnsSession.length > 0) {
        try {
          await connection.execute(`
            CREATE INDEX idx_stripe_session ON purchases (stripe_session_id)
          `);
          results.added.push("Índice idx_stripe_session");
        } catch (error) {
          results.existed.push("Índice idx_stripe_session");
        }
      }
      
      const [columnsIntent] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'stripe_payment_intent_id'
      `);
      
      if (columnsIntent.length > 0) {
        try {
          await connection.execute(`
            CREATE INDEX idx_stripe_payment ON purchases (stripe_payment_intent_id)
          `);
          results.added.push("Índice idx_stripe_payment");
        } catch (error) {
          results.existed.push("Índice idx_stripe_payment");
        }
      }
    } catch (error) {
      results.errors.push(`Erro ao adicionar índices: ${error.message}`);
    }
    
    connection.release();
    
    console.log("✅ Migração de campos do Stripe concluída com sucesso");
    return res.status(200).json({
      success: true,
      message: "Migração concluída com sucesso",
      results
    });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro na migração:", error);
    return res.status(500).json({ 
      error: "Erro na migração",
      message: error.message
    });
  }
} 