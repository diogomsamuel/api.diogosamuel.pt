import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Verifica se o usuário está autenticado e se tem um ID válido
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Usuário não autenticado corretamente" });
  }

  const userId = req.user.id;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Buscar dados básicos do usuário (sem a senha)
    try {
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

      // Inicializar com valores vazios seguros
      let profile = { message: "Perfil detalhado ainda não foi criado" };
      let weightLogs = [];
      let progressPhotos = [];
      let purchasedPlans = [];

      // Buscar dados do perfil do usuário
      try {
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
        if (profileRows.length > 0) {
          profile = profileRows[0];
        }
      } catch (profileError) {
        console.warn("Aviso: Erro ao buscar perfil de usuário:", profileError.message);
        // Continuar com perfil vazio
      }

      // Buscar dados de peso registrados
      try {
        const [weightLogsResult] = await connection.execute(
          `SELECT id, weight, log_date, notes, created_at
          FROM weight_logs
          WHERE user_id = ?
          ORDER BY log_date DESC
          LIMIT 10`,
          [userId]
        );
        weightLogs = weightLogsResult;
      } catch (weightError) {
        console.warn("Aviso: Erro ao buscar histórico de peso:", weightError.message);
        // Continuar com weightLogs vazio
      }

      // Buscar fotos de progresso
      try {
        const [progressPhotosResult] = await connection.execute(
          `SELECT id, photo_url, photo_date, photo_type, notes, created_at
          FROM progress_photos
          WHERE user_id = ?
          ORDER BY photo_date DESC
          LIMIT 5`,
          [userId]
        );
        progressPhotos = progressPhotosResult;
      } catch (photosError) {
        console.warn("Aviso: Erro ao buscar fotos de progresso:", photosError.message);
        // Continuar com progressPhotos vazio
      }

      // Buscar planos adquiridos
      try {
        const [purchasedPlansResult] = await connection.execute(
          `SELECT 
            p.id as purchase_id, 
            p.purchase_date,
            p.is_lifetime_access,
            p.access_granted,
            tp.id as plan_id,
            tp.name as plan_name,
            tp.description as plan_description,
            pv.id as variant_id,
            pv.training_frequency,
            pv.experience_level
          FROM purchases p
          JOIN training_plans tp ON p.plan_id = tp.id
          JOIN plan_variants pv ON p.variant_id = pv.id
          WHERE p.user_id = ? AND p.status = 'completed'
          ORDER BY p.purchase_date DESC`,
          [userId]
        );
        purchasedPlans = purchasedPlansResult.map(plan => ({
          ...plan,
          variant_name: `${plan.training_frequency}x por semana - Nível ${plan.experience_level}`
        }));
      } catch (plansError) {
        console.warn("Aviso: Erro ao buscar planos adquiridos:", plansError.message);
        // Continuar com purchasedPlans vazio
      }

      connection.release();
      
      return res.status(200).json({ 
        user,
        profile,
        weightLogs,
        progressPhotos,
        purchasedPlans
      });
    } catch (userError) {
      // Se ocorrer erro ao buscar dados básicos do usuário
      console.error("Erro ao buscar dados do usuário:", userError);
      
      if (userError.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({
          error: "Erro no sistema",
          message: "A estrutura do banco de dados não está configurada corretamente"
        });
      }
      
      throw userError; // Propagar para o catch externo
    }
    
  } catch (error) {
    if (connection) connection.release();
    
    console.error("Erro ao buscar perfil:", error);
    
    // Mensagens de erro mais específicas
    if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({ 
        error: "Erro de conexão",
        message: "Não foi possível conectar ao banco de dados" 
      });
    }
    
    return res.status(500).json({ 
      error: "Erro ao buscar perfil",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação" 
    });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 