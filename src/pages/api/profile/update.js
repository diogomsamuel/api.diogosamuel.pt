import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth, validateUserData } from "../../../lib/auth";

async function handler(req, res) {
  // Aceitar tanto PUT quanto POST para atualização de perfil
  if (req.method !== "PUT" && req.method !== "POST") {
    return res.status(405).json({ 
      success: false,
      error: "Método não permitido", 
      message: "Este endpoint aceita apenas os métodos PUT ou POST" 
    });
  }

  const userId = req.user.id;
  
  // Extrair os dados do usuário do corpo da requisição
  const { 
    first_name, 
    last_name, 
    email, 
    phone, 
    birth_date,
    profile_picture
  } = req.body;

  // Extrair os dados do perfil do corpo da requisição
  const { 
    height,
    initial_weight,
    current_weight,
    target_weight,
    address,
    city,
    state,
    country,
    postal_code,
    fitness_level,
    fitness_goals,
    health_conditions,
    preferred_training_days,
    preferred_training_times
  } = req.body;

  // Validar email se fornecido
  if (email) {
    const { isValid, errors } = validateUserData({ email }, []);
    if (!isValid) {
      return res.status(400).json({ 
        success: false,
        error: "Dados inválidos", 
        details: errors 
      });
    }
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Iniciar transação
    await connection.beginTransaction();

    // Verificar se o email já está em uso por outro usuário
    if (email) {
      const [existingEmail] = await connection.execute(
        "SELECT id FROM users WHERE email = ? AND id != ?", 
        [email, userId]
      );

      if (existingEmail.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ error: "Email já está em uso" });
      }
    }

    // Preparar o display_name baseado no first_name e last_name se existirem
    let display_name = null;
    if (first_name && last_name) {
      display_name = `${first_name} ${last_name}`;
    }

    // Atualizar dados básicos do usuário
    const userUpdateFields = [];
    const userUpdateValues = [];

    if (first_name !== undefined) {
      userUpdateFields.push("first_name = ?");
      userUpdateValues.push(first_name);
    }

    if (last_name !== undefined) {
      userUpdateFields.push("last_name = ?");
      userUpdateValues.push(last_name);
    }

    if (display_name !== null) {
      userUpdateFields.push("display_name = ?");
      userUpdateValues.push(display_name);
    }

    if (email !== undefined) {
      userUpdateFields.push("email = ?");
      userUpdateValues.push(email);
    }

    if (phone !== undefined) {
      userUpdateFields.push("phone = ?");
      userUpdateValues.push(phone);
    }

    if (birth_date !== undefined) {
      userUpdateFields.push("birth_date = ?");
      userUpdateValues.push(birth_date);
    }

    if (profile_picture !== undefined) {
      userUpdateFields.push("profile_picture = ?");
      userUpdateValues.push(profile_picture);
    }

    if (userUpdateFields.length > 0) {
      const userUpdateQuery = `
        UPDATE users 
        SET ${userUpdateFields.join(", ")}, updated_at = NOW()
        WHERE id = ?
      `;
      
      await connection.execute(
        userUpdateQuery,
        [...userUpdateValues, userId]
      );
    }

    // Verificar se o perfil do usuário existe
    const [profile] = await connection.execute(
      "SELECT id FROM user_profiles WHERE user_id = ?",
      [userId]
    );

    // Preparar campos para atualização ou criação do perfil
    const profileFields = [];
    const profileValues = [];

    if (height !== undefined) {
      profileFields.push("height = ?");
      profileValues.push(height);
    }

    if (initial_weight !== undefined) {
      profileFields.push("initial_weight = ?");
      profileValues.push(initial_weight);
    }

    if (current_weight !== undefined) {
      profileFields.push("current_weight = ?");
      profileValues.push(current_weight);
    }

    if (target_weight !== undefined) {
      profileFields.push("target_weight = ?");
      profileValues.push(target_weight);
    }

    if (address !== undefined) {
      profileFields.push("address = ?");
      profileValues.push(address);
    }

    if (city !== undefined) {
      profileFields.push("city = ?");
      profileValues.push(city);
    }

    if (state !== undefined) {
      profileFields.push("state = ?");
      profileValues.push(state);
    }

    if (country !== undefined) {
      profileFields.push("country = ?");
      profileValues.push(country);
    }

    if (postal_code !== undefined) {
      profileFields.push("postal_code = ?");
      profileValues.push(postal_code);
    }

    if (fitness_level !== undefined) {
      profileFields.push("fitness_level = ?");
      profileValues.push(fitness_level);
    }

    if (fitness_goals !== undefined) {
      profileFields.push("fitness_goals = ?");
      profileValues.push(fitness_goals);
    }

    if (health_conditions !== undefined) {
      profileFields.push("health_conditions = ?");
      profileValues.push(health_conditions);
    }

    if (preferred_training_days !== undefined) {
      profileFields.push("preferred_training_days = ?");
      profileValues.push(preferred_training_days);
    }

    if (preferred_training_times !== undefined) {
      profileFields.push("preferred_training_times = ?");
      profileValues.push(preferred_training_times);
    }

    if (profileFields.length > 0) {
      // Se o perfil existe, atualiza; caso contrário, cria um novo
      if (profile.length > 0) {
        const profileUpdateQuery = `
          UPDATE user_profiles 
          SET ${profileFields.join(", ")}, updated_at = NOW()
          WHERE user_id = ?
        `;
        
        await connection.execute(
          profileUpdateQuery,
          [...profileValues, userId]
        );
      } else {
        // Cria um novo perfil se não existir
        const profileFieldNames = Object.keys(req.body)
          .filter(key => [
            'height', 'initial_weight', 'current_weight', 'target_weight',
            'address', 'city', 'state', 'country', 'postal_code',
            'fitness_level', 'fitness_goals', 'health_conditions',
            'preferred_training_days', 'preferred_training_times'
          ].includes(key));
        
        if (profileFieldNames.length > 0) {
          const createProfileQuery = `
            INSERT INTO user_profiles (
              user_id, 
              ${profileFieldNames.join(', ')}, 
              created_at, 
              updated_at
            ) VALUES (
              ?, 
              ${profileFieldNames.map(() => '?').join(', ')}, 
              NOW(), 
              NOW()
            )
          `;
          
          await connection.execute(
            createProfileQuery,
            [userId, ...profileFieldNames.map(field => req.body[field])]
          );
        }
      }
    }

    // Confirmar a transação
    await connection.commit();
    connection.release();
    
    // Retornar resposta padronizada com sucesso
    return res.status(200).json({
      success: true,
      message: "Perfil atualizado com sucesso"
    });
  } catch (error) {
    // Reverter transação em caso de erro
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    
    console.error("❌ Erro ao atualizar perfil:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar perfil",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
}

// Aplicar middleware de autenticação e CORS com suporte a OPTIONS para preflight
export default allowCors(withAuth(handler)); 