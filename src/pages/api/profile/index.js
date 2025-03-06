import { pool } from '../../../db/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const userId = req.user.id;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Buscar dados básicos do usuário (sem a senha)
    const [userRows] = await connection.execute(
      `SELECT 
        id, username, first_name, last_name, display_name, 
        email, phone, birth_date, profile_picture, 
        is_active, is_verified, created_at, updated_at, last_login
      FROM users 
      WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const user = userRows[0];

    // Buscar dados do perfil do usuário
    const [profileRows] = await connection.execute(
      `SELECT 
        height, initial_weight, current_weight, target_weight,
        address, city, state, country, postal_code,
        fitness_level, fitness_goals, health_conditions,
        preferred_training_days, preferred_training_times,
        created_at, updated_at
      FROM user_profiles 
      WHERE user_id = ?`,
      [userId]
    );

    // Combinar os dados de usuário e perfil
    const profile = profileRows.length > 0 
      ? profileRows[0] 
      : { message: "Perfil detalhado ainda não foi criado" };

    // Buscar dados de peso registrados
    const [weightLogs] = await connection.execute(
      `SELECT id, weight, log_date, notes, created_at
       FROM weight_logs
       WHERE user_id = ?
       ORDER BY log_date DESC
       LIMIT 10`,
      [userId]
    );

    // Buscar fotos de progresso
    const [progressPhotos] = await connection.execute(
      `SELECT id, photo_path, photo_date, photo_type, notes, is_private, created_at
       FROM progress_photos
       WHERE user_id = ?
       ORDER BY photo_date DESC
       LIMIT 5`,
      [userId]
    );

    // Buscar planos adquiridos
    const [purchasedPlans] = await connection.execute(
      `SELECT 
         p.id as purchase_id, 
         p.purchase_date,
         p.is_lifetime_access,
         p.access_granted,
         tp.id as plan_id,
         tp.name as plan_name,
         tp.description as plan_description,
         pv.id as variant_id,
         pv.name as variant_name,
         pv.duration as variant_duration
       FROM purchases p
       JOIN training_plans tp ON p.plan_id = tp.id
       JOIN plan_variants pv ON p.variant_id = pv.id
       WHERE p.user_id = ? AND p.status = 'completed'
       ORDER BY p.purchase_date DESC`,
      [userId]
    );

    connection.release();
    
    return res.status(200).json({ 
      user,
      profile,
      weightLogs,
      progressPhotos,
      purchasedPlans
    });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Erro ao buscar perfil:", error);
    return res.status(500).json({ error: "Erro ao buscar perfil" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 