import { query } from '../../../../lib/db';
import { cors } from '../../../../lib/cors';

export default async function handler(req, res) {
  // Aplicar CORS para permitir chamadas do frontend
  await cors(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { adminSecret } = req.body;

    // Verificar a senha de admin
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verificar se a tabela existe
    await ensureTableExists();

    // Resetar todos os contadores
    await query('TRUNCATE TABLE link_clicks');

    return res.status(200).json({
      success: true,
      message: 'Stats reset successfully'
    });
  } catch (error) {
    console.error('[API] Error resetting stats:', error);
    return res.status(500).json({ error: 'Failed to reset stats', details: error.message });
  }
}

// Função para garantir que a tabela existe
async function ensureTableExists() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS link_clicks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        link_name VARCHAR(100) NOT NULL UNIQUE,
        click_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('[API] Tabela link_clicks verificada ou criada');
  } catch (error) {
    console.error('[API] Erro ao verificar/criar tabela:', error);
    throw error;
  }
} 