CREATE TABLE IF NOT EXISTS `project_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`userId` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joinedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
