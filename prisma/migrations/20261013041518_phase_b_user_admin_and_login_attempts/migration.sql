-- AlterTable
ALTER TABLE `user` ADD COLUMN `disabledAt` DATETIME(3) NULL,
    ADD COLUMN `disabledReason` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `login_attempt` (
    `id` VARCHAR(191) NOT NULL,
    `identifierHash` VARCHAR(191) NOT NULL,
    `ipHash` VARCHAR(191) NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempt_identifierHash_createdAt_idx`(`identifierHash`, `createdAt`),
    INDEX `login_attempt_ipHash_createdAt_idx`(`ipHash`, `createdAt`),
    INDEX `login_attempt_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
