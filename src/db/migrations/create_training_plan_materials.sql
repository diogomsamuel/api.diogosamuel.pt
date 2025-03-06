-- Criar tabela de materiais dos planos
CREATE TABLE IF NOT EXISTS training_plan_materials (
    id INT NOT NULL AUTO_INCREMENT,
    plan_id INT NOT NULL,
    material_type ENUM('pdf', 'video', 'audio', 'link') NOT NULL,
    material_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_material (plan_id, material_id),
    INDEX idx_material_type (material_type),
    INDEX idx_material_created (created_at),
    CONSTRAINT training_plan_materials_ibfk_1 FOREIGN KEY (plan_id) REFERENCES training_plans (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci; 