-- Add indexes for frequently queried columns

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_status ON users(is_active, is_verified);
CREATE INDEX idx_users_login ON users(last_login);

-- Training plans table indexes
CREATE INDEX idx_plans_status ON training_plans(status, is_active);
CREATE INDEX idx_plans_price ON training_plans(base_price, discount_price);
CREATE INDEX idx_plans_created ON training_plans(created_at);

-- Plan variants table indexes
CREATE INDEX idx_variants_plan ON plan_variants(plan_id, is_active);
CREATE INDEX idx_variants_level ON plan_variants(experience_level);

-- Purchases table indexes
CREATE INDEX idx_purchases_user ON purchases(user_id, status);
CREATE INDEX idx_purchases_plan ON purchases(plan_id, variant_id);
CREATE INDEX idx_purchases_date ON purchases(purchase_date);
CREATE INDEX idx_purchases_stripe ON purchases(stripe_session_id, stripe_payment_intent_id);

-- Access logs table indexes
CREATE INDEX idx_access_logs_user ON access_logs(user_id, access_type);
CREATE INDEX idx_access_logs_date ON access_logs(accessed_at);

-- User profiles table indexes
CREATE INDEX idx_profiles_fitness ON user_profiles(fitness_level);
CREATE INDEX idx_profiles_location ON user_profiles(city, state, country);

-- Progress tracking indexes
CREATE INDEX idx_weight_logs_date ON weight_logs(user_id, log_date);
CREATE INDEX idx_photos_date ON progress_photos(user_id, photo_date);

-- Materials access indexes
CREATE INDEX idx_materials_access_user ON user_materials_access(user_id, material_id);
CREATE INDEX idx_materials_access_date ON user_materials_access(first_access_date, last_access_date);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, action);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at); 