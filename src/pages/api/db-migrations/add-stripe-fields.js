import pool from "../../../lib/db";
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

// Esta API é para executar migrações específicas para o Stripe
// Deve ser acessível apenas pelo administrador
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Verificar se o usuário é administrador
  if (!req.user || req.user.username !== process.env.ADMIN_USERNAME) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Iniciar transação
    await connection.beginTransaction();

    console.log("🔄 Iniciando migração de campos do Stripe...");

    // 1. Adicionar campo stripe_customer_id à tabela users se não existir
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL,
        ADD INDEX idx_stripe_customer (stripe_customer_id)
      `);
      console.log("✅ Campo stripe_customer_id adicionado à tabela users");
    } catch (error) {
      // Verificar se o erro é porque a coluna já existe
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log("ℹ️ Campo stripe_customer_id já existe na tabela users");
      } else {
        throw error;
      }
    }

    // 2. Adicionar campos para stripe_session_id e stripe_payment_intent_id à tabela purchases
    try {
      // Primeiro, verificar se a coluna stripe_session_id já existe
      const [columnsSession] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'stripe_session_id'
      `);

      if (columnsSession.length === 0) {
        await connection.execute(`
          ALTER TABLE purchases
          ADD COLUMN stripe_session_id VARCHAR(255) DEFAULT NULL,
          ADD INDEX idx_stripe_session (stripe_session_id)
        `);
        console.log("✅ Campo stripe_session_id adicionado à tabela purchases");
      } else {
        console.log("ℹ️ Campo stripe_session_id já existe na tabela purchases");
      }

      // Verificar se a coluna stripe_payment_intent_id já existe
      const [columnsIntent] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'stripe_payment_intent_id'
      `);

      if (columnsIntent.length === 0) {
        await connection.execute(`
          ALTER TABLE purchases
          ADD COLUMN stripe_payment_intent_id VARCHAR(255) DEFAULT NULL,
          ADD INDEX idx_stripe_payment (stripe_payment_intent_id)
        `);
        console.log("✅ Campo stripe_payment_intent_id adicionado à tabela purchases");
      } else {
        console.log("ℹ️ Campo stripe_payment_intent_id já existe na tabela purchases");
      }
    } catch (error) {
      console.error("❌ Erro ao adicionar campos do Stripe à tabela purchases:", error);
      throw error;
    }

    // Commit da transação
    await connection.commit();
    connection.release();
    
    console.log("✅ Migração de campos do Stripe concluída com sucesso");
    
    return res.status(200).json({
      success: true,
      message: "Migração de campos do Stripe concluída com sucesso"
    });
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Erro ao realizar rollback:", rollbackError);
      }
      connection.release();
    }
    
    console.error("❌ Erro na migração de campos do Stripe:", error);
    return res.status(500).json({ 
      error: "Erro na migração de campos do Stripe",
      details: error.message
    });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 