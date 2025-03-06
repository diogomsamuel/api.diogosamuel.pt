import { authMiddleware } from '../../../../middleware/auth';
import { requestLogger } from '../../../../middleware/requestLogger';
import pool from '../../../../db/db';
import { Parser } from 'json2csv';
import { allowCors } from '../../../../lib/cors';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type } = req.query;
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs must be an array' });
    }

    let data = [];
    let fields = [];

    switch (type) {
      case 'users':
        const usersQuery = `
          SELECT 
            u.id, u.username, u.email, u.is_active, u.is_verified, u.created_at,
            p.first_name, p.last_name, p.phone, p.city, p.state, p.country,
            p.fitness_level, p.height, p.weight, p.goals
          FROM users u
          LEFT JOIN user_profiles p ON u.id = p.user_id
          WHERE u.id = ANY($1)
        `;
        const usersResult = await pool.query(usersQuery, [ids]);
        data = usersResult.rows;
        fields = [
          'id', 'username', 'email', 'is_active', 'is_verified', 'created_at',
          'first_name', 'last_name', 'phone', 'city', 'state', 'country',
          'fitness_level', 'height', 'weight', 'goals'
        ];
        break;

      case 'plans':
        const plansQuery = `
          SELECT 
            p.id, p.name, p.description, p.base_price, p.discount_price,
            p.is_active, p.created_at,
            COUNT(v.id) as variant_count,
            COUNT(DISTINCT pu.id) as purchase_count
          FROM training_plans p
          LEFT JOIN plan_variants v ON p.id = v.plan_id
          LEFT JOIN purchases pu ON p.id = pu.plan_id
          WHERE p.id = ANY($1)
          GROUP BY p.id
        `;
        const plansResult = await pool.query(plansQuery, [ids]);
        data = plansResult.rows;
        fields = [
          'id', 'name', 'description', 'base_price', 'discount_price',
          'is_active', 'created_at', 'variant_count', 'purchase_count'
        ];
        break;

      case 'sales':
        const salesQuery = `
          SELECT 
            p.id, p.user_id, u.email,
            p.plan_id, tp.name as plan_name,
            p.variant_id, pv.name as variant_name,
            p.status, p.amount, p.purchase_date,
            p.stripe_session_id, p.stripe_payment_intent_id
          FROM purchases p
          JOIN users u ON p.user_id = u.id
          JOIN training_plans tp ON p.plan_id = tp.id
          LEFT JOIN plan_variants pv ON p.variant_id = pv.id
          WHERE p.id = ANY($1)
        `;
        const salesResult = await pool.query(salesQuery, [ids]);
        data = salesResult.rows;
        fields = [
          'id', 'user_id', 'email', 'plan_id', 'plan_name',
          'variant_id', 'variant_name', 'status', 'amount',
          'purchase_date', 'stripe_session_id', 'stripe_payment_intent_id'
        ];
        break;

      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_export.csv`);
    res.status(200).send(csv);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default allowCors(authMiddleware(requestLogger(handler))); 