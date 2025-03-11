import pool from '../../../lib/db';
import { allowCors } from "../../../lib/cors";
import { withAuth } from "../../../lib/auth";

async function handler(req, res) {
  const userId = req.user.id;
  
  // POST: Adicionar nova foto de progresso
  if (req.method === "POST") {
    const { photo_path, photo_date, photo_type, notes, is_private } = req.body;
    
    // Validação básica
    if (!photo_path || !photo_date) {
      return res.status(400).json({ error: "Caminho da foto e data são obrigatórios" });
    }
    
    // Validar formato da data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(photo_date)) {
      return res.status(400).json({ error: "Data inválida, use o formato YYYY-MM-DD" });
    }
    
    // Validar tipo de foto
    const validTypes = ['front', 'back', 'side', 'other'];
    if (photo_type && !validTypes.includes(photo_type)) {
      return res.status(400).json({ error: `Tipo de foto inválido. Use um dos seguintes: ${validTypes.join(', ')}` });
    }
    
    let connection;
    try {
      connection = await pool.getConnection();
      
      // Inserir a foto de progresso
      const [result] = await connection.execute(
        `INSERT INTO progress_photos (
          user_id, photo_path, photo_date, photo_type, notes, is_private, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId, 
          photo_path, 
          photo_date, 
          photo_type || 'other', 
          notes || null, 
          is_private === false ? 0 : 1 // Se is_private não for explicitamente falso, considere-o como privado
        ]
      );
      
      connection.release();
      
      return res.status(201).json({
        success: true,
        message: "Foto de progresso adicionada com sucesso",
        id: result.insertId,
        photo_path,
        photo_date,
        photo_type: photo_type || 'other',
        is_private: is_private === false ? false : true
      });
      
    } catch (error) {
      if (connection) connection.release();
      console.error("❌ Erro ao adicionar foto de progresso:", error);
      return res.status(500).json({ error: "Erro ao adicionar foto de progresso" });
    }
  }
  
  // GET: Buscar fotos de progresso
  else if (req.method === "GET") {
    // Parâmetros de paginação e filtros
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const type = req.query.type;
    
    let connection;
    try {
      connection = await pool.getConnection();
      
      let query = `
        SELECT id, photo_path, photo_date, photo_type, notes, is_private, created_at
        FROM progress_photos
        WHERE user_id = ?
      `;
      
      const queryParams = [userId];
      
      // Adicionar filtros
      if (startDate && endDate) {
        query += ` AND photo_date BETWEEN ? AND ?`;
        queryParams.push(startDate, endDate);
      } else if (startDate) {
        query += ` AND photo_date >= ?`;
        queryParams.push(startDate);
      } else if (endDate) {
        query += ` AND photo_date <= ?`;
        queryParams.push(endDate);
      }
      
      if (type && ['front', 'back', 'side', 'other'].includes(type)) {
        query += ` AND photo_type = ?`;
        queryParams.push(type);
      }
      
      // Adicionar ordenação e paginação
      query += ` ORDER BY photo_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limit, offset);
      
      const [photos] = await connection.execute(query, queryParams);
      
      // Obter o total de registros para paginação
      const [totalCount] = await connection.execute(
        `SELECT COUNT(*) as total FROM progress_photos WHERE user_id = ?`,
        [userId]
      );
      
      connection.release();
      
      return res.status(200).json({
        photos,
        pagination: {
          total: totalCount[0].total,
          limit,
          offset
        }
      });
      
    } catch (error) {
      if (connection) connection.release();
      console.error("❌ Erro ao buscar fotos de progresso:", error);
      return res.status(500).json({ error: "Erro ao buscar fotos de progresso" });
    }
  }
  
  // DELETE: Excluir uma foto de progresso
  else if (req.method === "DELETE") {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "ID da foto é obrigatório" });
    }
    
    let connection;
    try {
      connection = await pool.getConnection();
      
      // Verificar se a foto pertence ao usuário
      const [photo] = await connection.execute(
        `SELECT id, photo_path FROM progress_photos WHERE id = ? AND user_id = ?`,
        [id, userId]
      );
      
      if (photo.length === 0) {
        connection.release();
        return res.status(404).json({ error: "Foto não encontrada" });
      }
      
      // Excluir a foto
      await connection.execute(
        `DELETE FROM progress_photos WHERE id = ?`,
        [id]
      );
      
      connection.release();
      
      return res.status(200).json({
        success: true,
        message: "Foto excluída com sucesso",
        photo_path: photo[0].photo_path
      });
      
    } catch (error) {
      if (connection) connection.release();
      console.error("❌ Erro ao excluir foto de progresso:", error);
      return res.status(500).json({ error: "Erro ao excluir foto de progresso" });
    }
  }
  
  // PUT: Atualizar informações de uma foto
  else if (req.method === "PUT") {
    const { id, photo_type, notes, is_private } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "ID da foto é obrigatório" });
    }
    
    // Validar tipo de foto
    const validTypes = ['front', 'back', 'side', 'other'];
    if (photo_type && !validTypes.includes(photo_type)) {
      return res.status(400).json({ error: `Tipo de foto inválido. Use um dos seguintes: ${validTypes.join(', ')}` });
    }
    
    let connection;
    try {
      connection = await pool.getConnection();
      
      // Verificar se a foto pertence ao usuário
      const [photo] = await connection.execute(
        `SELECT id FROM progress_photos WHERE id = ? AND user_id = ?`,
        [id, userId]
      );
      
      if (photo.length === 0) {
        connection.release();
        return res.status(404).json({ error: "Foto não encontrada" });
      }
      
      // Construir a consulta de atualização
      const updateFields = [];
      const updateValues = [];
      
      if (photo_type !== undefined) {
        updateFields.push("photo_type = ?");
        updateValues.push(photo_type);
      }
      
      if (notes !== undefined) {
        updateFields.push("notes = ?");
        updateValues.push(notes);
      }
      
      if (is_private !== undefined) {
        updateFields.push("is_private = ?");
        updateValues.push(is_private ? 1 : 0);
      }
      
      if (updateFields.length === 0) {
        connection.release();
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
      }
      
      // Executar a atualização
      await connection.execute(
        `UPDATE progress_photos SET ${updateFields.join(", ")} WHERE id = ?`,
        [...updateValues, id]
      );
      
      connection.release();
      
      return res.status(200).json({
        success: true,
        message: "Foto atualizada com sucesso",
        id
      });
      
    } catch (error) {
      if (connection) connection.release();
      console.error("❌ Erro ao atualizar foto de progresso:", error);
      return res.status(500).json({ error: "Erro ao atualizar foto de progresso" });
    }
  }
  
  else {
    return res.status(405).json({ error: "Método não permitido" });
  }
}

// Aplicar middleware de autenticação e CORS
export default allowCors(withAuth(handler)); 