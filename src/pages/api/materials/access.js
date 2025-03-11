import { authMiddleware } from '../../../middleware/auth';
import { allowCors } from '../../../lib/cors';
import pool from '../../../lib/db';
import { requestLogger } from '../../../middleware/requestLogger';

async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { userId, materialId } = req.query;
        const access = await pool.query(
          'SELECT * FROM user_materials_access WHERE user_id = ? AND material_id = ?',
          [userId, materialId]
        );
        return res.status(200).json(access);

      case 'POST':
        const { user_id, material_id, access_type } = req.body;
        const result = await pool.query(
          'INSERT INTO user_materials_access (user_id, material_id, access_type) VALUES (?, ?, ?)',
          [user_id, material_id, access_type]
        );
        return res.status(201).json({ id: result.insertId });

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Error in /api/materials/access:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Apply middleware for authentication, logging and CORS
export default allowCors(authMiddleware(requestLogger(handler))); 