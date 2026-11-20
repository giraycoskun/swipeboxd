CREATE TABLE `AgentAudit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tokenId` text NOT NULL,
	`action` text NOT NULL,
	`ok` integer NOT NULL,
	`errorCode` text,
	`durationMs` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `AgentAudit_tokenId_createdAt_idx` ON `AgentAudit` (`tokenId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `AgentToken` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`userId` text NOT NULL,
	`userName` text NOT NULL,
	`provider` text NOT NULL,
	`scope` text DEFAULT 'read' NOT NULL,
	`credential` text,
	`isLocal` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUsedAt` text,
	`revokedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AgentToken_prefix_key` ON `AgentToken` (`prefix`);--> statement-breakpoint
CREATE INDEX `AgentToken_userId_idx` ON `AgentToken` (`userId`);