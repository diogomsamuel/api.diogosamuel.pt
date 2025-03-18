import { query } from '../../../../lib/db';
import { cors } from '../../../../lib/cors';

export default async function handler(req, res) {
  // Aplicar CORS para permitir chamadas do frontend
  await cors(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar se a tabela existe, se não, criar
    await ensureTableExists();

    // Obter todos os links e suas contagens
    const links = await query('SELECT * FROM link_clicks ORDER BY click_count DESC');

    // Calcular estatísticas
    const totalClicks = links.reduce((sum, link) => sum + link.click_count, 0);
    const mostClickedLink = links.length > 0 ? {
      name: links[0].link_name,
      count: links[0].click_count
    } : { name: '', count: 0 };

    return res.status(200).json({
      success: true,
      stats: {
        totalClicks,
        linksCount: links.length,
        mostClickedLink
      },
      links: links.map(link => ({
        name: link.link_name,
        count: link.click_count,
        lastUpdated: link.updated_at
      }))
    });
  } catch (error) {
    console.error('[API] Error getting stats:', error);
    return res.status(500).json({ error: 'Failed to get stats', details: error.message });
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