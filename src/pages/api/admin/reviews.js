import { authMiddleware } from '../../../middleware/auth';
import { allowCors } from '../../../lib/cors';
import pool from '../../../lib/db';
import { requestLogger } from '../../../middleware/requestLogger';

async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        // Buscar todas as reviews (com filtros)
        const { 
          plan_id, 
          status, 
          verified_only,
          start_date,
          end_date,
          rating,
          limit = 50,
          offset = 0
        } = req.query;

        let query = `
          SELECT pr.*,
                 u.username,
                 u.display_name,
                 u.email,
                 tp.name as plan_name,
                 EXISTS(SELECT 1 FROM purchases p 
                        WHERE p.user_id = pr.user_id 
                        AND p.plan_id = pr.plan_id 
                        AND p.status = 'completed') as is_verified_purchase
          FROM plan_reviews pr
          JOIN users u ON pr.user_id = u.id
          JOIN training_plans tp ON pr.plan_id = tp.id
          WHERE 1=1
        `;
        const params = [];

        if (plan_id) {
          query += ' AND pr.plan_id = ?';
          params.push(plan_id);
        }

        if (status) {
          query += ' AND pr.is_published = ?';
          params.push(status === 'published' ? 1 : 0);
        }

        if (verified_only === 'true') {
          query += ' AND pr.is_verified_purchase = 1';
        }

        if (start_date) {
          query += ' AND pr.created_at >= ?';
          params.push(new Date(start_date));
        }

        if (end_date) {
          query += ' AND pr.created_at <= ?';
          params.push(new Date(end_date));
        }

        if (rating) {
          query += ' AND pr.rating = ?';
          params.push(parseInt(rating));
        }

        // Adicionar contagem total
        const [countResult] = await pool.execute(
          `SELECT COUNT(*) as total FROM (${query}) as subquery`,
          params
        );
        const total = countResult[0].total;

        // Adicionar ordenação e paginação
        query += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [reviews] = await pool.execute(query, params);

        return res.status(200).json({
          reviews,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            pages: Math.ceil(total / limit)
          }
        });

      case 'PUT':
        // Atualizar status da review (publicar/despublicar)
        const { id } = req.query;
        const { is_published } = req.body;

        if (!id || typeof is_published !== 'boolean') {
          return res.status(400).json({ 
            error: 'ID da review e status de publicação são obrigatórios' 
          });
        }

        await pool.execute(
          'UPDATE plan_reviews SET is_published = ? WHERE id = ?',
          [is_published, id]
        );

        // Buscar review atualizada
        const [updatedReview] = await pool.execute(
          `SELECT pr.*,
                  u.username,
                  u.display_name,
                  tp.name as plan_name
           FROM plan_reviews pr
           JOIN users u ON pr.user_id = u.id
           JOIN training_plans tp ON pr.plan_id = tp.id
           WHERE pr.id = ?`,
          [id]
        );

        if (updatedReview.length === 0) {
          return res.status(404).json({ error: 'Review não encontrada' });
        }

        return res.status(200).json(updatedReview[0]);

      case 'DELETE':
        // Deletar review (apenas admin)
        const reviewId = req.query.id;

        if (!reviewId) {
          return res.status(400).json({ error: 'ID da review é obrigatório' });
        }

        await pool.execute('DELETE FROM plan_reviews WHERE id = ?', [reviewId]);
        return res.status(200).json({ message: 'Review deletada com sucesso' });

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Método ${method} não permitido` });
    }
  } catch (error) {
    console.error('Erro ao processar reviews:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Aplicar middleware de autenticação, logging e CORS
export default allowCors(authMiddleware(requestLogger(handler))); 