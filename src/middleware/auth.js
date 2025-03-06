import { getSession } from 'next-auth/react';
import { allowCors } from '../lib/cors';

export function authMiddleware(handler) {
  return async (req, res) => {
    try {
      const session = await getSession({ req });

      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Add user info to request
      req.user = session.user;

      return handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}

// Exporta uma versão que já inclui o CORS
export const withAuth = (handler) => allowCors(authMiddleware(handler)); 