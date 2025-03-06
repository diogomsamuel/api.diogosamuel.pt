import { authMiddleware } from '../../../middleware/auth';
import { allowCors } from '../../../lib/cors';
import { pool } from '../../../db/db';
import { requestLogger } from '../../../middleware/requestLogger';

async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { planId, materialType } = req.query;
        const materials = await pool.query(
          'SELECT * FROM materials WHERE plan_id = ? AND material_type = ?',
          [planId, materialType]
        );
        return res.status(200).json(materials);

      case 'POST':
        const { plan_id, material_type, title, content, order } = req.body;
        const result = await pool.query(
          'INSERT INTO materials (plan_id, material_type, title, content, display_order) VALUES (?, ?, ?, ?, ?)',
          [plan_id, material_type, title, content, order]
        );
        return res.status(201).json({ id: result.insertId });

      case 'PUT':
        const { id, ...updateData } = req.body;
        await pool.query(
          'UPDATE materials SET ? WHERE id = ?',
          [updateData, id]
        );
        return res.status(200).json({ message: 'Material updated successfully' });

      case 'DELETE':
        const materialId = req.query.id;
        await pool.query('DELETE FROM materials WHERE id = ?', [materialId]);
        return res.status(200).json({ message: 'Material deleted successfully' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Error in /api/admin/materials:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Apply middleware for authentication, logging and CORS
export default allowCors(authMiddleware(requestLogger(handler))); 