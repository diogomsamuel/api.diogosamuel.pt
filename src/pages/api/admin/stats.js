import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ 
      success: false,
      error: "Método não permitido",
      message: "Este método não é suportado neste endpoint"
    });
  }

  // Log para diagnóstico
  console.log('[Admin Stats] Usuário da requisição:', req.user);
  
  // Verificação de segurança mais compreensiva
  if (!req.user) {
    console.error('[Admin Stats] Requisição sem usuário autenticado');
    return res.status(401).json({ 
      success: false,
      error: "Usuário não autenticado",
      message: "Você precisa estar logado para acessar este recurso"
    });
  }
  
  // Verificar se o usuário é administrador por wallet
  const isAdmin = req.user.walletAddress && 
                  req.user.walletAddress.toLowerCase() === process.env.ADMIN_WALLET?.toLowerCase();
  
  // Verificar se o usuário é administrador
  if (!isAdmin) {
    console.error('[Admin Stats] Usuário não é admin:', req.user.id);
    return res.status(403).json({ 
      success: false,
      error: "Acesso não autorizado",
      message: "Você não tem permissão para acessar este recurso"
    });
  }
  
  // Super Admin tem acesso completo (é o mesmo que isAdmin neste contexto)
  const isSuperAdmin = isAdmin;

  console.log('[Admin Stats] É super admin:', isSuperAdmin);

  let connection;
  try {
    connection = await pool.getConnection();

    // Buscar total de usuários
    const [usersCount] = await connection.execute(
      "SELECT COUNT(*) as total FROM users WHERE is_active = 1"
    );

    // Buscar total de planos ativos
    const [plansCount] = await connection.execute(
      "SELECT COUNT(*) as total FROM training_plans WHERE is_active = 1 AND status = 'published'"
    );

    // Buscar total de vendas
    const [salesCount] = await connection.execute(
      "SELECT COUNT(*) as total FROM purchases WHERE status = 'completed'"
    );

    // Buscar receita total
    const [revenue] = await connection.execute(
      "SELECT SUM(amount_paid) as total FROM purchases WHERE status = 'completed'"
    );

    // Buscar vendas recentes
    const [recentSales] = await connection.execute(`
      SELECT 
        p.id,
        u.username as user,
        tp.name as plan,
        p.amount_paid,
        p.purchase_date,
        p.status
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      JOIN training_plans tp ON p.plan_id = tp.id
      ORDER BY p.purchase_date DESC
      LIMIT 5
    `);

    connection.release();

    return res.status(200).json({
      stats: {
        totalUsers: usersCount[0].total,
        totalPlans: plansCount[0].total,
        totalSales: salesCount[0].total,
        revenueEUR: revenue[0].total || 0
      },
      recentSales
    });

  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao buscar estatísticas:", error);
    return res.status(500).json({ error: "Erro ao buscar estatísticas do dashboard" });
  }
}

// Proteger a rota com CORS e autenticação
export default allowCors(withAuth(handler)); 