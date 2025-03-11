import { withAuth } from '../../../middleware/auth';
import { allowCors } from '../../../lib/cors';
import pool from '../../../lib/db';

async function handler(req, res) {
  const { method } = req;
  const userId = req.user.id;

  try {
    switch (method) {
      case 'GET':
        // Buscar metas do usuário
        const { status, type } = req.query;
        let query = 'SELECT * FROM user_goals WHERE user_id = ?';
        const params = [userId];

        if (status) {
          query += ' AND status = ?';
          params.push(status);
        }

        if (type) {
          query += ' AND goal_type = ?';
          params.push(type);
        }

        query += ' ORDER BY created_at DESC';

        const [goals] = await pool.execute(query, params);
        return res.status(200).json(goals);

      case 'POST':
        // Criar nova meta
        const { goal_type, target_value, current_value, start_date, target_date, notes } = req.body;

        if (!goal_type || !target_value || !target_date) {
          return res.status(400).json({ 
            error: 'Tipo de meta, valor alvo e data alvo são obrigatórios' 
          });
        }

        const [result] = await pool.execute(
          `INSERT INTO user_goals (
            user_id, goal_type, target_value, current_value, 
            start_date, target_date, notes, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, goal_type, target_value, current_value || null,
            start_date || new Date(), target_date, notes || null, 'pending'
          ]
        );

        return res.status(201).json({
          id: result.insertId,
          goal_type,
          target_value,
          current_value,
          start_date,
          target_date,
          notes,
          status: 'pending'
        });

      case 'PUT':
        // Atualizar meta
        const { id } = req.query;
        const updates = req.body;

        if (!id) {
          return res.status(400).json({ error: 'ID da meta é obrigatório' });
        }

        // Verificar se a meta pertence ao usuário
        const [goalCheck] = await pool.execute(
          'SELECT id FROM user_goals WHERE id = ? AND user_id = ?',
          [id, userId]
        );

        if (goalCheck.length === 0) {
          return res.status(404).json({ error: 'Meta não encontrada' });
        }

        // Construir query de atualização dinamicamente
        const updateFields = [];
        const updateValues = [];
        
        const allowedFields = [
          'current_value', 'target_value', 'target_date', 
          'notes', 'status'
        ];

        for (const [key, value] of Object.entries(updates)) {
          if (allowedFields.includes(key)) {
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
          }
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
        }

        updateValues.push(id);
        await pool.execute(
          `UPDATE user_goals SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );

        // Buscar meta atualizada
        const [updatedGoal] = await pool.execute(
          'SELECT * FROM user_goals WHERE id = ?',
          [id]
        );

        return res.status(200).json(updatedGoal[0]);

      case 'DELETE':
        // Deletar uma meta
        const goalId = req.query.id;

        if (!goalId) {
          return res.status(400).json({ error: 'ID da meta é obrigatório' });
        }

        // Verificar se a meta pertence ao usuário
        const [goalToDelete] = await pool.execute(
          'SELECT id FROM user_goals WHERE id = ? AND user_id = ?',
          [goalId, userId]
        );

        if (goalToDelete.length === 0) {
          return res.status(404).json({ error: 'Meta não encontrada' });
        }

        await pool.execute('DELETE FROM user_goals WHERE id = ?', [goalId]);
        return res.status(200).json({ message: 'Meta deletada com sucesso' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Método ${method} não permitido` });
    }
  } catch (error) {
    console.error('Erro ao processar metas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 