import { withAuth } from '../../../../lib/auth';
import pool from '../../../../lib/db';
import { allowCors } from '../../../../lib/cors';

const handler = async (req, res) => {
  // Verificar se o usuário é administrador
  if (!req.user || (!req.user.isAdmin && req.user.id !== 7)) {
    return res.status(403).json({ 
      success: false,
      error: "Acesso não autorizado",
      message: "Você não tem permissão para realizar esta operação"
    });
  }

  const { type, id } = req.query;

  if (!['PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ 
      success: false,
      error: "Método não permitido",
      message: "Este método não é suportado neste endpoint"
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    switch (type) {
      case 'users':
        if (req.method === 'PUT') {
          const { is_active } = req.body;
          
          // Verificar se o usuário existe antes de atualizar
          const [userCheck] = await connection.execute(
            'SELECT id FROM users WHERE id = ?',
            [id]
          );

          if (userCheck.length === 0) {
            connection.release();
            return res.status(404).json({ 
              success: false,
              error: "Usuário não encontrado",
              message: "O usuário que você está tentando editar não existe"
            });
          }

          const [result] = await connection.execute(`
            UPDATE users 
            SET is_active = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [is_active ? 1 : 0, id]);
          
          if (result.affectedRows === 0) {
            connection.release();
            return res.status(404).json({ 
              success: false,
              error: "Usuário não encontrado",
              message: "O usuário que você está tentando editar não existe"
            });
          }
          
          // Buscar dados atualizados do usuário
          const [updatedUser] = await connection.execute(
            'SELECT id, username, email, is_active FROM users WHERE id = ?',
            [id]
          );
          
          connection.release();
          return res.status(200).json({
            success: true,
            user: updatedUser[0]
          });
        } else {
          // Delete user and related data
          await connection.beginTransaction();
          
          try {
            // Verificar se o usuário existe
            const [userCheck] = await connection.execute(
              'SELECT id FROM users WHERE id = ?',
              [id]
            );

            if (userCheck.length === 0) {
              await connection.rollback();
              connection.release();
              return res.status(404).json({ 
                success: false,
                error: "Usuário não encontrado",
                message: "O usuário que você está tentando excluir não existe"
              });
            }

            // Delete related records first
            await connection.execute('DELETE FROM progress_photos WHERE user_id = ?', [id]);
            await connection.execute('DELETE FROM weight_logs WHERE user_id = ?', [id]);
            await connection.execute('DELETE FROM access_logs WHERE user_id = ?', [id]);
            await connection.execute('DELETE FROM user_profiles WHERE user_id = ?', [id]);
            await connection.execute('DELETE FROM purchases WHERE user_id = ?', [id]);
            
            // Finally delete the user
            const [deleteResult] = await connection.execute('DELETE FROM users WHERE id = ?', [id]);
            
            if (deleteResult.affectedRows === 0) {
              throw new Error('Usuário não encontrado');
            }
            
            await connection.commit();
            connection.release();
            return res.status(200).json({ 
              success: true,
              message: 'Usuário excluído com sucesso'
            });
          } catch (error) {
            await connection.rollback();
            throw error;
          }
        }

      case 'plans':
        if (req.method === 'PUT') {
          const { is_active } = req.body;
          
          const [result] = await connection.execute(`
            UPDATE training_plans 
            SET is_active = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [is_active ? 1 : 0, id]);
          
          if (result.affectedRows === 0) {
            connection.release();
            return res.status(404).json({ 
              success: false,
              error: "Plano não encontrado",
              message: "O plano que você está tentando editar não existe"
            });
          }
          
          // Buscar dados atualizados do plano
          const [updatedPlan] = await connection.execute(
            'SELECT id, name, is_active FROM training_plans WHERE id = ?',
            [id]
          );
          
          connection.release();
          return res.status(200).json({
            success: true,
            plan: updatedPlan[0]
          });
        } else {
          // Delete plan and related data
          await connection.beginTransaction();
          
          try {
            // Delete related records first
            await connection.execute('DELETE FROM plan_variants WHERE plan_id = ?', [id]);
            await connection.execute('DELETE FROM purchases WHERE plan_id = ?', [id]);
            
            // Finally delete the plan
            const [deleteResult] = await connection.execute('DELETE FROM training_plans WHERE id = ?', [id]);
            
            if (deleteResult.affectedRows === 0) {
              throw new Error('Plano não encontrado');
            }
            
            await connection.commit();
            connection.release();
            return res.status(200).json({ 
              success: true,
              message: 'Plano excluído com sucesso'
            });
          } catch (error) {
            await connection.rollback();
            throw error;
          }
        }

      case 'sales':
        if (req.method === 'PUT') {
          const { status } = req.body;
          
          const [result] = await connection.execute(`
            UPDATE purchases 
            SET status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [status, id]);
          
          if (result.affectedRows === 0) {
            connection.release();
            return res.status(404).json({ 
              success: false,
              error: "Venda não encontrada",
              message: "A venda que você está tentando editar não existe"
            });
          }
          
          // Buscar dados atualizados da venda
          const [updatedSale] = await connection.execute(
            'SELECT id, user_id, plan_id, status FROM purchases WHERE id = ?',
            [id]
          );
          
          connection.release();
          return res.status(200).json({
            success: true,
            sale: updatedSale[0]
          });
        } else {
          const [deleteResult] = await connection.execute('DELETE FROM purchases WHERE id = ?', [id]);
          
          if (deleteResult.affectedRows === 0) {
            connection.release();
            return res.status(404).json({ 
              success: false,
              error: "Venda não encontrada",
              message: "A venda que você está tentando excluir não existe"
            });
          }
          
          connection.release();
          return res.status(200).json({ 
            success: true,
            message: 'Venda excluída com sucesso'
          });
        }

      default:
        connection.release();
        return res.status(400).json({ 
          success: false,
          error: "Tipo inválido",
          message: "O tipo de operação especificado não é válido"
        });
    }
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Erro ao fazer rollback:', rollbackError);
      }
      connection.release();
    }
    
    console.error('Erro ao processar requisição:', error);
    
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ 
        success: false,
        error: error.message,
        message: "O recurso solicitado não foi encontrado"
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: "Erro interno do servidor",
      message: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro ao processar sua solicitação"
    });
  }
};

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 