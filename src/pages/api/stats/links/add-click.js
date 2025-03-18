import { query } from '../../../../lib/db';
import { cors } from '../../../../lib/cors';

export default async function handler(req, res) {
  // Aplicar CORS para permitir chamadas do frontend
  await cors(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { linkName } = req.body;

    if (!linkName) {
      return res.status(400).json({ error: 'Link name is required' });
    }

    // Verificar se a tabela existe, se não, criar
    await ensureTableExists();

    // Verificar se o link já existe
    const existingLinks = await query(
      'SELECT * FROM link_clicks WHERE link_name = ?',
      [linkName]
    );

    if (existingLinks.length === 0) {
      // Criar o registro com 1 clique
      await query(
        'INSERT INTO link_clicks (link_name, click_count) VALUES (?, 1)',
        [linkName]
      );
    } else {
      // Incrementar o contador
      await query(
        'UPDATE link_clicks SET click_count = click_count + 1 WHERE link_name = ?',
        [linkName]
      );
    }

    // Obter o novo valor para retornar
    const [updatedLink] = await query(
      'SELECT * FROM link_clicks WHERE link_name = ?',
      [linkName]
    );

    return res.status(200).json({
      success: true,
      clickCount: updatedLink.click_count
    });
  } catch (error) {
    console.error('[API] Error adding click:', error);
    return res.status(500).json({ error: 'Failed to add click', details: error.message });
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