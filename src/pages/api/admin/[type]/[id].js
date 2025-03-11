import { authMiddleware } from '../../../../middleware/auth';
import { requestLogger } from '../../../../middleware/requestLogger';
import pool from '../../../../lib/db';
import { allowCors } from '../../../../lib/cors';

const handler = async (req, res) => {
  const { type, id } = req.query;

  if (!['PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    switch (type) {
      case 'users':
        if (req.method === 'PUT') {
          const { is_active } = req.body;
          const updateUserQuery = `
            UPDATE users 
            SET is_active = $1, 
                updated_at = NOW() 
            WHERE id = $2 
            RETURNING id, username, email, is_active
          `;
          const result = await pool.query(updateUserQuery, [is_active, id]);
          
          if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
          }
          
          return res.status(200).json(result.rows[0]);
        } else {
          // Delete user and related data
          await pool.query('BEGIN');
          
          try {
            // Delete related records first
            await pool.query('DELETE FROM progress_photos WHERE user_id = $1', [id]);
            await pool.query('DELETE FROM weight_logs WHERE user_id = $1', [id]);
            await pool.query('DELETE FROM access_logs WHERE user_id = $1', [id]);
            await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [id]);
            await pool.query('DELETE FROM purchases WHERE user_id = $1', [id]);
            
            // Finally delete the user
            const deleteResult = await pool.query('DELETE FROM users WHERE id = $1', [id]);
            
            if (deleteResult.rowCount === 0) {
              throw new Error('User not found');
            }
            
            await pool.query('COMMIT');
            return res.status(200).json({ message: 'User deleted successfully' });
          } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
          }
        }

      case 'plans':
        if (req.method === 'PUT') {
          const { is_active } = req.body;
          const updatePlanQuery = `
            UPDATE training_plans 
            SET is_active = $1, 
                updated_at = NOW() 
            WHERE id = $2 
            RETURNING id, name, is_active
          `;
          const result = await pool.query(updatePlanQuery, [is_active, id]);
          
          if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Plan not found' });
          }
          
          return res.status(200).json(result.rows[0]);
        } else {
          // Delete plan and related data
          await pool.query('BEGIN');
          
          try {
            // Delete related records first
            await pool.query('DELETE FROM plan_variants WHERE plan_id = $1', [id]);
            await pool.query('DELETE FROM purchases WHERE plan_id = $1', [id]);
            
            // Finally delete the plan
            const deleteResult = await pool.query('DELETE FROM training_plans WHERE id = $1', [id]);
            
            if (deleteResult.rowCount === 0) {
              throw new Error('Plan not found');
            }
            
            await pool.query('COMMIT');
            return res.status(200).json({ message: 'Plan deleted successfully' });
          } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
          }
        }

      case 'sales':
        if (req.method === 'PUT') {
          const { status } = req.body;
          const updateSaleQuery = `
            UPDATE purchases 
            SET status = $1, 
                updated_at = NOW() 
            WHERE id = $2 
            RETURNING id, user_id, plan_id, status
          `;
          const result = await pool.query(updateSaleQuery, [status, id]);
          
          if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Sale not found' });
          }
          
          return res.status(200).json(result.rows[0]);
        } else {
          const deleteResult = await pool.query('DELETE FROM purchases WHERE id = $1', [id]);
          
          if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'Sale not found' });
          }
          
          return res.status(200).json({ message: 'Sale deleted successfully' });
        }

      default:
        return res.status(400).json({ error: 'Invalid type' });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    
    if (error.message === 'User not found' || error.message === 'Plan not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Aplicar middleware de autenticação, logging e CORS
export default allowCors(authMiddleware(requestLogger(handler))); 