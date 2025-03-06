CREATE DATABASE  IF NOT EXISTS "training" /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `training`;
-- MySQL dump 10.13  Distrib 8.0.41, for macos15 (arm64)
--
-- Host: mysql-training-diogosamuel.j.aivencloud.com    Database: training
-- ------------------------------------------------------
-- Server version	8.0.35

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '6823c0ed-eed1-11ef-a660-c66a68667f83:1-74';

--
-- Table structure for table `access_logs`
--

DROP TABLE IF EXISTS `access_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `access_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_id` int NOT NULL,
  `user_id` int NOT NULL,
  `variant_id` int NOT NULL,
  `access_type` enum('pdf_download','content_view') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `accessed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `variant_id` (`variant_id`),
  KEY `idx_purchase_logs` (`purchase_id`),
  CONSTRAINT `access_logs_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `access_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `access_logs_ibfk_3` FOREIGN KEY (`variant_id`) REFERENCES `plan_variants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `access_logs`
--

LOCK TABLES `access_logs` WRITE;
/*!40000 ALTER TABLE `access_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `access_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `action` varchar(255) NOT NULL,
  `description` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role` enum('admin','editor','support','viewer') NOT NULL DEFAULT 'viewer',
  `permissions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `admin_users_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `body_measurements`
--

DROP TABLE IF EXISTS `body_measurements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `body_measurements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `chest` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `waist` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `hips` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `biceps_left` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `biceps_right` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `thigh_left` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `thigh_right` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `calf_left` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `calf_right` decimal(5,2) DEFAULT NULL COMMENT 'em cm',
  `body_fat_percentage` decimal(5,2) DEFAULT NULL,
  `measurement_date` date NOT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_measurements_date` (`measurement_date`),
  CONSTRAINT `body_measurements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `body_measurements`
--

LOCK TABLES `body_measurements` WRITE;
/*!40000 ALTER TABLE `body_measurements` DISABLE KEYS */;
/*!40000 ALTER TABLE `body_measurements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `description` text,
  `order_index` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_categories`
--

DROP TABLE IF EXISTS `plan_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_categories` (
  `plan_id` int NOT NULL,
  `category_id` int NOT NULL,
  PRIMARY KEY (`plan_id`,`category_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `plan_categories_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `training_plans` (`id`),
  CONSTRAINT `plan_categories_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_categories`
--

LOCK TABLES `plan_categories` WRITE;
/*!40000 ALTER TABLE `plan_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `plan_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_features`
--

DROP TABLE IF EXISTS `plan_features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `icon_name` varchar(100) DEFAULT NULL,
  `order_index` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `plan_id` (`plan_id`),
  CONSTRAINT `plan_features_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `training_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_features`
--

LOCK TABLES `plan_features` WRITE;
/*!40000 ALTER TABLE `plan_features` DISABLE KEYS */;
/*!40000 ALTER TABLE `plan_features` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_materials`
--

DROP TABLE IF EXISTS `plan_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `file_path` varchar(255) NOT NULL,
  `file_type` enum('pdf','video','image','excel','word','other') NOT NULL,
  `file_size` int DEFAULT NULL COMMENT 'tamanho em bytes',
  `order_sequence` int DEFAULT '0',
  `is_preview` tinyint(1) DEFAULT '0' COMMENT 'material disponível como prévia',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `plan_id` (`plan_id`),
  KEY `variant_id` (`variant_id`),
  KEY `idx_materials_type` (`file_type`),
  CONSTRAINT `plan_materials_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `training_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `plan_materials_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `plan_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_materials`
--

LOCK TABLES `plan_materials` WRITE;
/*!40000 ALTER TABLE `plan_materials` DISABLE KEYS */;
/*!40000 ALTER TABLE `plan_materials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_reviews`
--

DROP TABLE IF EXISTS `plan_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `purchase_id` int NOT NULL,
  `rating` int NOT NULL COMMENT 'de 1 a 5 estrelas',
  `review_text` text,
  `is_published` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `plan_id` (`plan_id`),
  KEY `purchase_id` (`purchase_id`),
  CONSTRAINT `plan_reviews_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `plan_reviews_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `training_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `plan_reviews_ibfk_3` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_reviews`
--

LOCK TABLES `plan_reviews` WRITE;
/*!40000 ALTER TABLE `plan_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `plan_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_variants`
--

DROP TABLE IF EXISTS `plan_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_variants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `training_frequency` int NOT NULL,
  `experience_level` enum('beginner','intermediate','advanced') NOT NULL,
  `pdf_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plan_variants` (`plan_id`),
  CONSTRAINT `plan_variants_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `training_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_variants`
--

LOCK TABLES `plan_variants` WRITE;
/*!40000 ALTER TABLE `plan_variants` DISABLE KEYS */;
/*!40000 ALTER TABLE `plan_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `progress_photos`
--

DROP TABLE IF EXISTS `progress_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `progress_photos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `photo_path` varchar(255) NOT NULL,
  `photo_date` date NOT NULL,
  `photo_type` enum('front','back','side','other') DEFAULT 'other',
  `notes` text,
  `is_private` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_progress_date` (`photo_date`),
  CONSTRAINT `progress_photos_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `progress_photos`
--

LOCK TABLES `progress_photos` WRITE;
/*!40000 ALTER TABLE `progress_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `progress_photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchases`
--

DROP TABLE IF EXISTS `purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `variant_id` int NOT NULL,
  `amount_paid` decimal(10,2) NOT NULL,
  `stripe_session_id` varchar(255) DEFAULT NULL,
  `stripe_payment_intent_id` varchar(255) DEFAULT NULL,
  `status` enum('pending','completed','failed','refunded') NOT NULL,
  `is_lifetime_access` tinyint(1) DEFAULT '1',
  `access_granted` tinyint(1) DEFAULT '0',
  `access_granted_date` timestamp NULL DEFAULT NULL,
  `notes` text,
  `purchase_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `plan_id` (`plan_id`),
  KEY `variant_id` (`variant_id`),
  KEY `idx_user_purchases` (`user_id`),
  KEY `idx_purchases_status` (`status`),
  CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `purchases_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `training_plans` (`id`),
  CONSTRAINT `purchases_ibfk_3` FOREIGN KEY (`variant_id`) REFERENCES `plan_variants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchases`
--

LOCK TABLES `purchases` WRITE;
/*!40000 ALTER TABLE `purchases` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_plans`
--

DROP TABLE IF EXISTS `training_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `short_description` varchar(500) DEFAULT NULL,
  `base_price` decimal(10,2) NOT NULL,
  `discount_price` decimal(10,2) DEFAULT NULL,
  `stripe_product_id` varchar(255) DEFAULT NULL,
  `stripe_price_id` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version` int DEFAULT '1',
  `status` enum('draft','published','archived') DEFAULT 'draft',
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status_version` (`status`,`version`),
  KEY `idx_plan_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_plans`
--

LOCK TABLES `training_plans` WRITE;
/*!40000 ALTER TABLE `training_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `training_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_goals`
--

DROP TABLE IF EXISTS `user_goals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_goals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `target_date` date DEFAULT NULL,
  `status` enum('active','completed','abandoned','paused') NOT NULL DEFAULT 'active',
  `progress_percentage` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_goals_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_goals`
--

LOCK TABLES `user_goals` WRITE;
/*!40000 ALTER TABLE `user_goals` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_goals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_materials_access`
--

DROP TABLE IF EXISTS `user_materials_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_materials_access` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `material_id` int NOT NULL,
  `purchase_id` int NOT NULL,
  `first_access_date` timestamp NULL DEFAULT NULL,
  `last_access_date` timestamp NULL DEFAULT NULL,
  `access_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_material` (`user_id`,`material_id`),
  KEY `material_id` (`material_id`),
  KEY `purchase_id` (`purchase_id`),
  CONSTRAINT `user_materials_access_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_materials_access_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `plan_materials` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_materials_access_ibfk_3` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_materials_access`
--

LOCK TABLES `user_materials_access` WRITE;
/*!40000 ALTER TABLE `user_materials_access` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_materials_access` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_notifications`
--

DROP TABLE IF EXISTS `user_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('system','purchase','plan','progress','other') NOT NULL DEFAULT 'system',
  `is_read` tinyint(1) DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `related_id` int DEFAULT NULL COMMENT 'ID relacionado ao tipo da notificação',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_notifications`
--

LOCK TABLES `user_notifications` WRITE;
/*!40000 ALTER TABLE `user_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_profiles`
--

DROP TABLE IF EXISTS `user_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `height` decimal(5,2) DEFAULT NULL COMMENT 'altura em cm',
  `initial_weight` decimal(5,2) DEFAULT NULL COMMENT 'peso inicial em kg',
  `current_weight` decimal(5,2) DEFAULT NULL COMMENT 'peso atual em kg',
  `target_weight` decimal(5,2) DEFAULT NULL COMMENT 'peso alvo em kg',
  `address` text,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `fitness_level` enum('beginner','intermediate','advanced') DEFAULT NULL,
  `fitness_goals` text,
  `health_conditions` text,
  `preferred_training_days` varchar(255) DEFAULT NULL,
  `preferred_training_times` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `user_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_profiles`
--

LOCK TABLES `user_profiles` WRITE;
/*!40000 ALTER TABLE `user_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `last_activity` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `password` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `wallet_address` varchar(42) DEFAULT NULL,
  `login_type` enum('traditional','wallet') NOT NULL DEFAULT 'traditional',
  `is_active` tinyint(1) DEFAULT '1',
  `is_verified` tinyint(1) DEFAULT '0',
  `verification_token` varchar(255) DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` timestamp NULL DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `wallet_address` (`wallet_address`),
  KEY `idx_wallet` (`wallet_address`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'test@test.com',NULL,NULL,NULL,'test@test.com@placeholder.com',NULL,NULL,NULL,'$2b$10$/RSSWI3qU5Wm0lvegEL72et.3Hxi1yh5CHpYBv7eoRqPKuWWrDpPy','2025-02-26 11:10:29','2025-03-06 11:12:38',NULL,'traditional',1,0,NULL,NULL,NULL,NULL),(2,'wallet@mail.com',NULL,NULL,NULL,'wallet@mail.com@placeholder.com',NULL,NULL,NULL,'$2b$10$b/x52TaQ6ARBHTwdJMYoH.gj2X3nZhjrpc6WOOqqxajy0OUJ6gX2y','2025-03-03 15:10:43','2025-03-06 11:12:38',NULL,'traditional',1,0,NULL,NULL,NULL,NULL),(3,'test1@test.com',NULL,NULL,NULL,'test1@test.com@placeholder.com',NULL,NULL,NULL,'$2b$10$LeEY.0CyhqxmlwdQH.eEauDu09ViKsnaoqSFGiLXKxYyuBQ3nv1hS','2025-03-04 19:37:58','2025-03-06 11:12:38',NULL,'traditional',1,0,NULL,NULL,NULL,NULL),(4,'queroentrar@gmail.com',NULL,NULL,NULL,'queroentrar@gmail.com@placeholder.com',NULL,NULL,NULL,'$2b$10$DXDz9E0AjH3MbFD5Rznt9./YWlw2eaE2q/oC5m47oB2PWxd4Pa8qG','2025-03-05 13:38:21','2025-03-06 11:12:38',NULL,'traditional',1,0,NULL,NULL,NULL,NULL),(5,'xpto@mail.com',NULL,NULL,NULL,'xpto@mail.com@placeholder.com',NULL,NULL,NULL,'$2b$10$7M6S8Iy5MZs8CE8W4cNwROkOaNvecIjACI1vzql7H3MyLElu7fhai','2025-03-05 16:58:27','2025-03-06 11:12:38',NULL,'traditional',1,0,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `weight_logs`
--

DROP TABLE IF EXISTS `weight_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weight_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `weight` decimal(5,2) NOT NULL COMMENT 'peso em kg',
  `log_date` date NOT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_weight_logs_date` (`log_date`),
  CONSTRAINT `weight_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `weight_logs`
--

LOCK TABLES `weight_logs` WRITE;
/*!40000 ALTER TABLE `weight_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `weight_logs` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-03-06 11:16:44
