import Stripe from 'stripe';
import { buffer } from 'micro';
import pool from "../../../lib/db";

// Desativar o parser de corpo padrão do Next.js para webhooks
export const config = {
  api: {
    bodyParser: false,
  },
};

// NOTA: NÃO estamos usando o middleware allowCors aqui
// para permitir que o Stripe envie webhooks sem restrições CORS
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const stripeSignature = req.headers['stripe-signature'];
  if (!stripeSignature) {
    return res.status(400).json({ error: 'Assinatura do Stripe ausente' });
  }

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    console.error('⚠️ Stripe webhook secret is missing');
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  let event;
  try {
    const buf = await buffer(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Verificar a assinatura do webhook
    event = stripe.webhooks.constructEvent(
      buf.toString(),
      stripeSignature,
      stripeWebhookSecret
    );
  } catch (err) {
    console.error(`⚠️ Webhook Error: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Processar eventos específicos
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(event.data.object);
    } else if (event.type === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(event.data.object);
    } else if (event.type === 'payment_intent.payment_failed') {
      await handlePaymentIntentFailed(event.data.object);
    }

    // Responder ao Stripe para confirmar recebimento
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`❌ Error processing webhook: ${error.message}`);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Processa um checkout bem-sucedido
 */
async function handleCheckoutSessionCompleted(session) {
  // Extrair dados da sessão
  const { metadata } = session;
  if (!metadata || !metadata.purchaseId) {
    console.error('❌ Metadata missing in checkout session');
    return;
  }

  const purchaseId = metadata.purchaseId;
  const userId = metadata.userId;
  const planId = metadata.plan_id;

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Iniciar transação
    await connection.beginTransaction();
    
    // Verificar se a compra existe e está pendente
    const [purchaseRows] = await connection.execute(`
      SELECT id, user_id, plan_id, variant_id, status
      FROM purchases
      WHERE id = ? AND status = 'pending'
    `, [purchaseId]);
    
    if (purchaseRows.length === 0) {
      console.warn(`⚠️ Purchase ${purchaseId} not found or not pending`);
      await connection.rollback();
      connection.release();
      return;
    }
    
    // Atualizar o status da compra
    await connection.execute(`
      UPDATE purchases
      SET 
        status = 'completed', 
        access_granted = 1, 
        access_granted_date = NOW(),
        stripe_payment_intent_id = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [session.payment_intent, purchaseId]);
    
    // Buscar os materiais do plano
    const [materials] = await connection.execute(`
      SELECT id
      FROM plan_materials
      WHERE plan_id = ?
    `, [planId]);
    
    // Conceder acesso aos materiais
    if (materials.length > 0) {
      const materialValues = materials.map(material => 
        `(${userId}, ${material.id}, ${purchaseId}, NULL, NULL, 0, NOW())`
      ).join(', ');
      
      // Inserir registros de acesso ao material
      await connection.execute(`
        INSERT INTO user_materials_access (
          user_id, material_id, purchase_id, 
          first_access_date, last_access_date, access_count, created_at
        ) VALUES ${materialValues}
      `);
    }
    
    // Registrar o pagamento no log de atividades
    await connection.execute(`
      INSERT INTO activity_logs (
        user_id, action, description, created_at
      ) VALUES (?, ?, ?, NOW())
    `, [
      userId, 
      'purchase_completed', 
      `Compra #${purchaseId} concluída via Stripe`
    ]);
    
    // Commit da transação
    await connection.commit();
    connection.release();
    
    console.log(`✅ Purchase ${purchaseId} completed successfully`);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(`❌ Rollback error: ${rollbackError.message}`);
      }
      connection.release();
    }
    console.error(`❌ Error processing checkout completion: ${error.message}`);
    throw error;
  }
}

/**
 * Processa um pagamento bem-sucedido
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  // Este evento geralmente já foi processado por checkout.session.completed
  // Mas pode ser usado como backup ou para processos adicionais
  console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
}

/**
 * Processa um pagamento falhado
 */
async function handlePaymentIntentFailed(paymentIntent) {
  let connection;
  try {
    // Buscar a compra associada a este pagamento
    connection = await pool.getConnection();
    
    const [purchaseRows] = await connection.execute(`
      SELECT id, user_id
      FROM purchases
      WHERE stripe_payment_intent_id = ?
    `, [paymentIntent.id]);
    
    if (purchaseRows.length === 0) {
      connection.release();
      return;
    }
    
    const purchaseId = purchaseRows[0].id;
    const userId = purchaseRows[0].user_id;
    
    // Atualizar o status da compra para falha
    await connection.execute(`
      UPDATE purchases
      SET status = 'failed', updated_at = NOW()
      WHERE id = ?
    `, [purchaseId]);
    
    // Registrar a falha no log de atividades
    await connection.execute(`
      INSERT INTO activity_logs (
        user_id, action, description, created_at
      ) VALUES (?, ?, ?, NOW())
    `, [
      userId, 
      'purchase_failed', 
      `Falha no pagamento da compra #${purchaseId} via Stripe`
    ]);
    
    connection.release();
    console.log(`❌ Payment failed for purchase ${purchaseId}`);
  } catch (error) {
    if (connection) connection.release();
    console.error(`❌ Error processing payment failure: ${error.message}`);
  }
}

// Exportar o handler diretamente, sem o middleware CORS
export default handler; 