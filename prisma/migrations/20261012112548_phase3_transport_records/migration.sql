-- CreateTable
CREATE TABLE `operator` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `registrationNumber` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `addressLine` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `operator_code_key`(`code`),
    UNIQUE INDEX `operator_registrationNumber_key`(`registrationNumber`),
    INDEX `operator_status_idx`(`status`),
    INDEX `operator_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicle` (
    `id` VARCHAR(191) NOT NULL,
    `registrationNumber` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NOT NULL,
    `vehicleType` VARCHAR(191) NOT NULL DEFAULT 'BUS',
    `make` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `modelYear` INTEGER NULL,
    `seatingCapacity` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `vehicle_registrationNumber_key`(`registrationNumber`),
    INDEX `vehicle_operatorId_idx`(`operatorId`),
    INDEX `vehicle_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `originCity` VARCHAR(191) NOT NULL,
    `destinationCity` VARCHAR(191) NOT NULL,
    `distanceKm` DECIMAL(8, 2) NULL,
    `estimatedMinutes` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `route_code_key`(`code`),
    INDEX `route_status_idx`(`status`),
    INDEX `route_originCity_destinationCity_idx`(`originCity`, `destinationCity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permit` (
    `id` VARCHAR(191) NOT NULL,
    `permitNumber` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NULL,
    `routeId` VARCHAR(191) NULL,
    `permitType` VARCHAR(191) NOT NULL DEFAULT 'ROUTE',
    `issuedOn` DATE NULL,
    `expiresOn` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `recordedSource` VARCHAR(191) NOT NULL DEFAULT 'MANUAL_ENTRY',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `permit_permitNumber_key`(`permitNumber`),
    INDEX `permit_operatorId_idx`(`operatorId`),
    INDEX `permit_vehicleId_idx`(`vehicleId`),
    INDEX `permit_routeId_idx`(`routeId`),
    INDEX `permit_status_idx`(`status`),
    INDEX `permit_expiresOn_idx`(`expiresOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_operator` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedBy` VARCHAR(191) NULL,

    INDEX `user_operator_operatorId_idx`(`operatorId`),
    UNIQUE INDEX `user_operator_userId_operatorId_key`(`userId`, `operatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vehicle` ADD CONSTRAINT `vehicle_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permit` ADD CONSTRAINT `permit_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permit` ADD CONSTRAINT `permit_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permit` ADD CONSTRAINT `permit_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_operator` ADD CONSTRAINT `user_operator_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_operator` ADD CONSTRAINT `user_operator_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `operator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
