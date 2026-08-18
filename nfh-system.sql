-- ============================================================================
-- Northfairway Homes Homeowners Association (NFH HOA) System Database Schema
-- Database Name: nfh-system
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `u_JTnAs3` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `u_JTnAs3`;

-- Disable Foreign Key Checks globally for this session
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Drop Child Tables First (to prevent parent foreign key constraint errors)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `requests`;
DROP TABLE IF EXISTS `alerts`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `fees`;

-- ----------------------------------------------------------------------------
-- Drop Parent Table
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;

-- ----------------------------------------------------------------------------
-- Table structure for `users`
-- ----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(50) NOT NULL,
  `middle_name` VARCHAR(50) DEFAULT NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `suffix` VARCHAR(20) DEFAULT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `mobile` VARCHAR(20) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('Homeowner', 'Secretary', 'Treasurer', 'President', 'Admin') NOT NULL DEFAULT 'Homeowner',
  `gender` VARCHAR(20) DEFAULT 'NA',
  `dob` DATE DEFAULT NULL,
  `civil_status` VARCHAR(20) DEFAULT 'Single',
  `block` VARCHAR(20) DEFAULT NULL,
  `lot` VARCHAR(20) DEFAULT NULL,
  `household` INT DEFAULT 1,
  `status` ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `emergency_contact_name` VARCHAR(100) DEFAULT NULL,
  `emergency_contact_number` VARCHAR(20) DEFAULT NULL,
  `emergency_contact_relationship` VARCHAR(50) DEFAULT NULL,
  `email_notifications` TINYINT(1) DEFAULT 1,
  `sms_notifications` TINYINT(1) DEFAULT 1,
  `date_joined` DATE DEFAULT (CURRENT_DATE),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `fees`
-- ----------------------------------------------------------------------------
CREATE TABLE `fees` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_name` VARCHAR(100) NOT NULL UNIQUE,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `proposed_amount` DECIMAL(10,2) DEFAULT NULL,
  `status` ENUM('Active', 'Pending President Approval', 'Rejected') NOT NULL DEFAULT 'Active',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `requests`
-- ----------------------------------------------------------------------------
CREATE TABLE `requests` (
  `id` VARCHAR(50) PRIMARY KEY,
  `user_id` INT NOT NULL,
  `request_type` VARCHAR(100) NOT NULL,
  `assigned_officer` VARCHAR(100) DEFAULT 'Secretary',
  `status` ENUM('Submitted', 'Under Review', 'Checked', 'For Correction', 'Pending President Approval', 'Approved', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Submitted',
  `payment_status` ENUM('Unpaid', 'Paid') NOT NULL DEFAULT 'Unpaid',
  `fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `details` JSON DEFAULT NULL,
  `attachment` VARCHAR(255) DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `date_submitted` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_requests_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `alerts`
-- ----------------------------------------------------------------------------
CREATE TABLE `alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `text` TEXT NOT NULL,
  `time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `unread` TINYINT(1) DEFAULT 1,
  CONSTRAINT `fk_alerts_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `audit_logs`
-- ----------------------------------------------------------------------------
CREATE TABLE `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `username` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `item` VARCHAR(100) NOT NULL,
  `prev_val` TEXT DEFAULT NULL,
  `new_val` TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable Foreign Key Checks
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- Seed Initial Data: System Administrator Account
-- Credentials: Username: admin | Password: admin123456
-- ----------------------------------------------------------------------------
INSERT INTO `users` (
  `first_name`, `last_name`, `username`, `email`, `mobile`, `password_hash`, `role`, `status`
) VALUES (
  'System',
  'Admin',
  'admin',
  'capstone.team2.bsis@gmail.com',
  '09123456789',
  'scrypt:32768:8:1$uS8zZbL7qE1R7y7x$2cb0c2c1a89c44e99f92e850b182d33d6bdfb2d69f37968512dd4f9540bc2b1448b11fbcfbd1b12b53e7f457ec7bc61e1b4b7f7396c39a3f29059e02c610931d',
  'Admin',
  'Active'
) ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `role` = 'Admin';

-- ----------------------------------------------------------------------------
-- Seed Initial Data: Standard System Fees
-- ----------------------------------------------------------------------------
INSERT INTO `fees` (`item_name`, `amount`, `status`) VALUES
('Gate Pass', 50.00, 'Active'),
('Proof of Residency', 50.00, 'Active'),
('Promissoary Note', 50.00, 'Active'),
('Certificate of Improvement', 50.00, 'Active'),
('Certificate of Membership', 100.00, 'Active'),
('Move-in Gate Pass', 50.00, 'Active'),
('Move-out Gate Pass', 50.00, 'Active'),
('Vehicle Sticker (4 Wheels)', 200.00, 'Active'),
('Vehicle Sticker (2/3 Wheels)', 100.00, 'Active'),
('Renters/Tenants Information Form', 50.00, 'Active')
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`);