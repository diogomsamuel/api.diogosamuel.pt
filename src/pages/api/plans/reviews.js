import { authMiddleware } from '../../../middleware/auth';
import { allowCors } from '../../../lib/cors';
import pool from '../../../lib/db';
import { requestLogger } from '../../../middleware/requestLogger';

async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { planId } = req.query;
        const reviews = await pool.query(
          `SELECT r.*, u.username, u.avatar_url 
           FROM plan_reviews r 
           JOIN users u ON r.user_id = u.id 
           WHERE r.plan_id = ? 
           ORDER BY r.created_at DESC`,
          [planId]
        );
        return res.status(200).json(reviews);

      case 'POST':
        const { user_id, plan_id, rating, comment } = req.body;
        
        // Check if user has already reviewed this plan
        const existingReview = await pool.query(
          'SELECT id FROM plan_reviews WHERE user_id = ? AND plan_id = ?',
          [user_id, plan_id]
        );

        if (existingReview.length > 0) {
          return res.status(400).json({ error: 'User has already reviewed this plan' });
        }

        const result = await pool.query(
          'INSERT INTO plan_reviews (user_id, plan_id, rating, comment) VALUES (?, ?, ?, ?)',
          [user_id, plan_id, rating, comment]
        );

        return res.status(201).json({ id: result.insertId });

      case 'PUT':
        const { review_id, new_rating, new_comment } = req.body;
        await pool.query(
          'UPDATE plan_reviews SET rating = ?, comment = ?, updated_at = NOW() WHERE id = ?',
          [new_rating, new_comment, review_id]
        );
        return res.status(200).json({ message: 'Review updated successfully' });

      case 'DELETE':
        const { id } = req.query;
        await pool.query('DELETE FROM plan_reviews WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Review deleted successfully' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Error in /api/plans/reviews:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Apply middleware for authentication, logging and CORS
export default allowCors(authMiddleware(requestLogger(handler))); 