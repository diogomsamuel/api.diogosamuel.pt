import { withAuth } from '../../../middleware/auth';
import { allowCors } from '../../../lib/cors';
import { pool } from '../../../db/db';
import { validateMeasurementType } from '../../../lib/validators';

async function handler(req, res) {
  const { method } = req;
  const userId = req.user.id;

  try {
    switch (method) {
      case 'GET':
        // Buscar medidas do usuário
        const { type, startDate, endDate } = req.query;
        let query = 'SELECT * FROM body_measurements WHERE user_id = ?';
        const params = [userId];

        if (type) {
          query += ' AND measurement_type = ?';
          params.push(type);
        }

        if (startDate) {
          query += ' AND measurement_date >= ?';
          params.push(new Date(startDate));
        }

        if (endDate) {
          query += ' AND measurement_date <= ?';
          params.push(new Date(endDate));
        }

        query += ' ORDER BY measurement_date DESC';

        const [measurements] = await pool.execute(query, params);
        return res.status(200).json(measurements);

      case 'POST':
        // Adicionar nova medida
        const { measurement_type, value, notes } = req.body;

        if (!measurement_type || !value) {
          return res.status(400).json({ error: 'Tipo de medida e valor são obrigatórios' });
        }

        if (!validateMeasurementType(measurement_type)) {
          return res.status(400).json({ error: 'Tipo de medida inválido' });
        }

        const [result] = await pool.execute(
          'INSERT INTO body_measurements (user_id, measurement_type, value, notes) VALUES (?, ?, ?, ?)',
          [userId, measurement_type, value, notes || null]
        );

        return res.status(201).json({
          id: result.insertId,
          measurement_type,
          value,
          notes,
          measurement_date: new Date()
        });

      case 'DELETE':
        // Deletar uma medida específica
        const { id } = req.query;

        if (!id) {
          return res.status(400).json({ error: 'ID da medida é obrigatório' });
        }

        // Verificar se a medida pertence ao usuário
        const [measurementCheck] = await pool.execute(
          'SELECT id FROM body_measurements WHERE id = ? AND user_id = ?',
          [id, userId]
        );

        if (measurementCheck.length === 0) {
          return res.status(404).json({ error: 'Medida não encontrada' });
        }

        await pool.execute('DELETE FROM body_measurements WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Medida deletada com sucesso' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: `Método ${method} não permitido` });
    }
  } catch (error) {
    console.error('Erro ao processar medidas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 