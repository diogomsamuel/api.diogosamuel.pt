import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";
import { getCheckoutSession } from "../../../lib/stripe";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const userId = req.user.id;
  const { session_id } = req.query;
  
  if (!session_id) {
    return res.status(400).json({ error: "ID da sessão é obrigatório" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Verificar se existe uma compra associada a esta sessão
    const [purchaseRows] = await connection.execute(`
      SELECT 
        p.id, p.status, p.plan_id, p.variant_id, p.amount_paid,
        p.is_lifetime_access, p.access_granted, p.access_granted_date,
        p.purchase_date, p.updated_at,
        tp.name as plan_name,
        pv.name as variant_name
      FROM purchases p
      JOIN training_plans tp ON p.plan_id = tp.id
      JOIN plan_variants pv ON p.variant_id = pv.id
      WHERE p.stripe_session_id = ? AND p.user_id = ?
    `, [session_id, userId]);
    
    if (purchaseRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Compra não encontrada" });
    }
    
    const purchase = purchaseRows[0];
    
    // Se a compra já estiver completa, retorne os detalhes
    if (purchase.status === 'completed') {
      // Buscar materiais disponíveis
      const [materials] = await connection.execute(`
        SELECT 
          m.id, m.title, m.file_type, m.file_size
        FROM plan_materials m
        JOIN user_materials_access uma ON m.id = uma.material_id
        WHERE uma.user_id = ? AND uma.purchase_id = ?
        ORDER BY m.order_sequence ASC
      `, [userId, purchase.id]);
      
      purchase.materials = materials;
      purchase.materials_count = materials.length;
      
      connection.release();
      
      return res.status(200).json({
        success: true,
        status: 'completed',
        purchase
      });
    }
    
    // Se não estiver completa, verificar no Stripe
    try {
      const session = await getCheckoutSession(session_id);
      
      if (session.payment_status === 'paid') {
        // Se pago no Stripe mas não atualizado no banco, atualizar
        // (normalmente isso seria feito pelo webhook, mas fazemos aqui como backup)
        if (purchase.status !== 'completed') {
          await connection.execute(`
            UPDATE purchases
            SET 
              status = 'completed', 
              access_granted = 1, 
              access_granted_date = NOW(),
              stripe_payment_intent_id = ?,
              updated_at = NOW()
            WHERE id = ?
          `, [session.payment_intent, purchase.id]);
          
          // Buscar materiais do plano
          const [materials] = await connection.execute(`
            SELECT id
            FROM plan_materials
            WHERE plan_id = ?
          `, [purchase.plan_id]);
          
          // Conceder acesso aos materiais se ainda não foi feito
          if (materials.length > 0) {
            // Verificar se já existem registros de acesso para evitar duplicação
            const [existingAccess] = await connection.execute(`
              SELECT COUNT(*) as count
              FROM user_materials_access
              WHERE user_id = ? AND purchase_id = ?
            `, [userId, purchase.id]);
            
            if (existingAccess[0].count === 0) {
              const materialValues = materials.map(material => 
                `(${userId}, ${material.id}, ${purchase.id}, NULL, NULL, 0, NOW())`
              ).join(', ');
              
              await connection.execute(`
                INSERT INTO user_materials_access (
                  user_id, material_id, purchase_id, 
                  first_access_date, last_access_date, access_count, created_at
                ) VALUES ${materialValues}
              `);
            }
          }
          
          purchase.status = 'completed';
          purchase.access_granted = 1;
          purchase.access_granted_date = new Date();
        }
        
        // Buscar materiais disponíveis
        const [materials] = await connection.execute(`
          SELECT 
            m.id, m.title, m.file_type, m.file_size
          FROM plan_materials m
          JOIN user_materials_access uma ON m.id = uma.material_id
          WHERE uma.user_id = ? AND uma.purchase_id = ?
          ORDER BY m.order_sequence ASC
        `, [userId, purchase.id]);
        
        purchase.materials = materials;
        purchase.materials_count = materials.length;
        
        connection.release();
        
        return res.status(200).json({
          success: true,
          status: 'completed',
          purchase
        });
      } else {
        // Pagamento pendente ou falhou
        connection.release();
        
        return res.status(200).json({
          success: true,
          status: session.payment_status,
          purchase: {
            ...purchase,
            stripe_status: session.payment_status,
            stripe_session: {
              id: session.id,
              url: session.url,
              customer: session.customer
            }
          }
        });
      }
    } catch (stripeError) {
      console.error('❌ Erro ao verificar sessão no Stripe:', stripeError);
      connection.release();
      
      return res.status(200).json({
        success: false,
        status: purchase.status,
        error: "Não foi possível verificar o status do pagamento no Stripe",
        purchase
      });
    }
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao verificar pagamento:", error);
    return res.status(500).json({ error: "Erro ao verificar status do pagamento" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 