CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`windowStart` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_task_idx` ON `comments` (`taskId`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_members_project_user_unique` ON `project_members` (`projectId`,`userId`);--> statement-breakpoint
CREATE INDEX `project_members_user_idx` ON `project_members` (`userId`);--> statement-breakpoint
CREATE INDEX `tasks_project_status_position_idx` ON `tasks` (`projectId`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assigneeId`);