-- Add missing columns to kitchens table
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `code` VARCHAR(20) DEFAULT NULL AFTER `kitchen_name`;
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `description` TEXT DEFAULT NULL AFTER `code`;
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `color_tag` VARCHAR(20) DEFAULT '#4F46E5' AFTER `description`;
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `default_prep_time` INT DEFAULT 15 AFTER `color_tag`;
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `printer_ip` VARCHAR(50) DEFAULT NULL AFTER `default_prep_time`;
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `printer_port` INT DEFAULT 9100 AFTER `printer_ip`;
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `auto_print` TINYINT(1) DEFAULT 0 AFTER `printer_port`;
ALTER TABLE `kitchens` ADD COLUMN IF NOT EXISTS `is_default` TINYINT(1) DEFAULT 0 AFTER `auto_print`;

