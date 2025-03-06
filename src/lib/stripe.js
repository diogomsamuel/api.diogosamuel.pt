import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('⚠️ Stripe secret key is missing. Payment processing will not work.');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16', // Usando a versão mais recente da API do Stripe
});

/**
 * Cria uma sessão de checkout do Stripe
 * @param {Object} options - Opções para a sessão de checkout
 * @returns {Promise<Stripe.Checkout.Session>} - Sessão de checkout do Stripe
 */
export async function createCheckoutSession({
  customerId,
  customerEmail,
  planName,
  planId,
  variantId,
  amount,
  metadata = {}
}) {
  try {
    // Garantir que o valor está em centavos (Stripe trabalha com a menor unidade monetária)
    const amountInCents = Math.round(amount * 100);
    
    // Criar uma sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
      customer_email: !customerId ? customerEmail : undefined,
      success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: planName,
              metadata: {
                plan_id: planId,
                variant_id: variantId
              }
            },
            unit_amount: amountInCents
          },
          quantity: 1
        }
      ],
      metadata: {
        plan_id: planId,
        variant_id: variantId,
        user_id: metadata.userId,
        ...metadata
      }
    });
    
    return session;
  } catch (error) {
    console.error('❌ Erro ao criar sessão de checkout do Stripe:', error);
    throw error;
  }
}

/**
 * Verifica se uma sessão de checkout é válida
 * @param {string} sessionId - ID da sessão de checkout
 * @returns {Promise<Object>} - Dados da sessão
 */
export async function getCheckoutSession(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer']
    });
    return session;
  } catch (error) {
    console.error('❌ Erro ao verificar sessão de checkout do Stripe:', error);
    throw error;
  }
}

/**
 * Cria ou atualiza um cliente no Stripe
 * @param {Object} customerData - Dados do cliente
 * @returns {Promise<Stripe.Customer>} - Cliente do Stripe
 */
export async function createOrUpdateCustomer({
  customerId,
  email,
  name,
  metadata = {}
}) {
  try {
    if (customerId) {
      // Atualizar cliente existente
      const customer = await stripe.customers.update(customerId, {
        email,
        name,
        metadata
      });
      return customer;
    } else {
      // Criar novo cliente
      const customer = await stripe.customers.create({
        email,
        name,
        metadata
      });
      return customer;
    }
  } catch (error) {
    console.error('❌ Erro ao criar/atualizar cliente no Stripe:', error);
    throw error;
  }
}

export default stripe; 