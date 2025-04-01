ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);