import { pool } from '../../../db/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";
import { createCheckoutSession, createOrUpdateCustomer } from "../../../lib/stripe";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const userId = req.user.id;
  
  // Extrair os dados da requisição
  const { plan_id, variant_id } = req.body;
  
  // Validação básica dos dados
  if (!plan_id || !variant_id) {
    return res.status(400).json({ error: "Plano e variante são obrigatórios" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Iniciar transação
    await connection.beginTransaction();
    
    // Verificar se o plano existe e está ativo
    const [plan] = await connection.execute(`
      SELECT id, name, base_price, discount_price, is_active, status
      FROM training_plans
      WHERE id = ? AND is_active = 1 AND status = 'published'
    `, [plan_id]);
    
    if (plan.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "Plano não encontrado ou indisponível" });
    }
    
    // Verificar se a variante existe e está ativa
    const [variant] = await connection.execute(`
      SELECT id, name, price, duration, is_active
      FROM plan_variants
      WHERE id = ? AND plan_id = ? AND is_active = 1
    `, [variant_id, plan_id]);
    
    if (variant.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "Variante não encontrada ou indisponível" });
    }
    
    // Verificar se o usuário já possui este plano/variante
    const [existingPurchase] = await connection.execute(`
      SELECT id, status
      FROM purchases
      WHERE user_id = ? AND plan_id = ? AND variant_id = ? AND status = 'completed'
    `, [userId, plan_id, variant_id]);
    
    if (existingPurchase.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ error: "Você já adquiriu este plano" });
    }
    
    // Obter informações do usuário para o Stripe
    const [userInfo] = await connection.execute(`
      SELECT id, username, email, first_name, last_name, display_name, stripe_customer_id
      FROM users
      WHERE id = ?
    `, [userId]);
    
    if (userInfo.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    
    const user = userInfo[0];
    const userName = user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    
    // Calcular o valor da compra
    const price = variant[0].price;
    
    // Criar um registro de compra pendente
    const [result] = await connection.execute(`
      INSERT INTO purchases (
        user_id, plan_id, variant_id, amount_paid, status, 
        is_lifetime_access, purchase_date, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', 1, NOW(), NOW())
    `, [
      userId, 
      plan_id, 
      variant_id, 
      price
    ]);
    
    const purchaseId = result.insertId;
    
    // Criar ou atualizar o cliente no Stripe
    let stripeCustomerId = user.stripe_customer_id;
    
    if (!stripeCustomerId) {
      const customer = await createOrUpdateCustomer({
        email: user.email,
        name: userName,
        metadata: {
          user_id: userId
        }
      });
      
      stripeCustomerId = customer.id;
      
      // Salvar o ID do cliente Stripe para uso futuro
      await connection.execute(`
        UPDATE users
        SET stripe_customer_id = ?
        WHERE id = ?
      `, [stripeCustomerId, userId]);
    }
    
    // Criar uma sessão de checkout no Stripe
    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      customerEmail: user.email,
      planName: `${plan[0].name} - ${variant[0].name}`,
      planId: plan_id,
      variantId: variant_id,
      amount: price,
      metadata: {
        userId: userId,
        purchaseId: purchaseId
      }
    });
    
    // Atualizar a compra com o ID da sessão do Stripe
    await connection.execute(`
      UPDATE purchases
      SET stripe_session_id = ?, updated_at = NOW()
      WHERE id = ?
    `, [session.id, purchaseId]);
    
    // Commit da transação
    await connection.commit();
    connection.release();
    
    // Retornar a URL para o checkout do Stripe
    return res.status(200).json({
      success: true,
      message: "Sessão de checkout criada com sucesso",
      checkout_url: session.url,
      session_id: session.id
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
    
    console.error("❌ Erro ao processar compra:", error);
    return res.status(500).json({ error: "Erro ao processar compra" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 