import pool from "../../../lib/db";
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  const userId = req.user.id;
  
  // POST: Registrar novo peso
  if (req.method === "POST") {
    const { weight, log_date, notes } = req.body;
    
    // Validação básica
    if (!weight || !log_date) {
      return res.status(400).json({ error: "Peso e data são obrigatórios" });
    }
    
    // Validar formato do peso (numérico)
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
      return res.status(400).json({ error: "Peso inválido" });
    }
    
    // Validar formato da data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(log_date)) {
      return res.status(400).json({ error: "Data inválida, use o formato YYYY-MM-DD" });
    }
    
    let connection;
    try {
      connection = await pool.getConnection();
      
      // Inserir o registro de peso
      const [result] = await connection.execute(
        `INSERT INTO weight_logs (user_id, weight, log_date, notes, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, weightValue, log_date, notes || null]
      );
      
      // Atualizar o peso atual no perfil do usuário
      await connection.execute(
        `UPDATE user_profiles 
         SET current_weight = ?, updated_at = NOW()
         WHERE user_id = ?`,
        [weightValue, userId]
      );
      
      connection.release();
      
      return res.status(201).json({
        success: true,
        message: "Peso registrado com sucesso",
        id: result.insertId,
        weight: weightValue,
        log_date,
        notes
      });
      
    } catch (error) {
      if (connection) connection.release();
      console.error("❌ Erro ao registrar peso:", error);
      return res.status(500).json({ error: "Erro ao registrar peso" });
    }
  }
  
  // GET: Buscar histórico de peso
  else if (req.method === "GET") {
    // Parâmetros de paginação e filtros
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    
    let connection;
    try {
      connection = await pool.getConnection();
      
      let query = `
        SELECT id, weight, log_date, notes, created_at
        FROM weight_logs
        WHERE user_id = ?
      `;
      
      const queryParams = [userId];
      
      // Adicionar filtros de data se fornecidos
      if (startDate && endDate) {
        query += ` AND log_date BETWEEN ? AND ?`;
        queryParams.push(startDate, endDate);
      } else if (startDate) {
        query += ` AND log_date >= ?`;
        queryParams.push(startDate);
      } else if (endDate) {
        query += ` AND log_date <= ?`;
        queryParams.push(endDate);
      }
      
      // Adicionar ordenação e paginação
      query += ` ORDER BY log_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limit, offset);
      
      const [logs] = await connection.execute(query, queryParams);
      
      // Obter o total de registros para paginação
      const [totalCount] = await connection.execute(
        `SELECT COUNT(*) as total FROM weight_logs WHERE user_id = ?`,
        [userId]
      );
      
      connection.release();
      
      return res.status(200).json({
        logs,
        pagination: {
          total: totalCount[0].total,
          limit,
          offset
        }
      });
      
    } catch (error) {
      if (connection) connection.release();
      console.error("❌ Erro ao buscar histórico de peso:", error);
      return res.status(500).json({ error: "Erro ao buscar histórico de peso" });
    }
  }
  
  // DELETE: Excluir um registro de peso
  else if (req.method === "DELETE") {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "ID do registro é obrigatório" });
    }
    
    let connection;
    try {
      connection = await pool.getConnection();
      
      // Verificar se o registro pertence ao usuário
      const [weightLog] = await connection.execute(
        `SELECT id FROM weight_logs WHERE id = ? AND user_id = ?`,
        [id, userId]
      );
      
      if (weightLog.length === 0) {
        connection.release();
        return res.status(404).json({ error: "Registro não encontrado" });
      }
      
      // Excluir o registro
      await connection.execute(
        `DELETE FROM weight_logs WHERE id = ?`,
        [id]
      );
      
      connection.release();
      
      return res.status(200).json({
        success: true,
        message: "Registro excluído com sucesso"
      });
      
    } catch (error) {
      if (connection) connection.release();
      console.error("❌ Erro ao excluir registro de peso:", error);
      return res.status(500).json({ error: "Erro ao excluir registro de peso" });
    }
  }
  
  else {
    return res.status(405).json({ error: "Método não permitido" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 