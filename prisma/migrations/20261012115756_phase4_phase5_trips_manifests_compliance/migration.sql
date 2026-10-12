-- CreateTable
CREATE TABLE `trip` (
    `id` VARCHAR(191) NOT NULL,
    `tripRef` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NULL,
    `routeId` VARCHAR(191) NULL,
    `departureAt` DATETIME(3) NOT NULL,
    `arrivalAt` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SCHEDULED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `trip_tripRef_key`(`tripRef`),
    INDEX `trip_operatorId_idx`(`operatorId`),
    INDEX `trip_departureAt_idx`(`departureAt`),
    INDEX `trip_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `passenger` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `passengerName` VARCHAR(191) NOT NULL,
    `fatherName` VARCHAR(191) NOT NULL,
    `identityType` VARCHAR(191) NOT NULL DEFAULT 'CNIC',
    `identityNumberEncrypted` TEXT NOT NULL,
    `identityFingerprint` VARCHAR(191) NOT NULL,
    `identityMasked` VARCHAR(191) NOT NULL,
    `mobileEncrypted` TEXT NOT NULL,
    `mobileMasked` VARCHAR(191) NOT NULL,
    `permanentAddressEncrypted` TEXT NOT NULL,
    `removedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `passenger_identityFingerprint_idx`(`identityFingerprint`),
    UNIQUE INDEX `passenger_tripId_identityFingerprint_key`(`tripId`, `identityFingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inspection` (
    `id` VARCHAR(191) NOT NULL,
    `siteName` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `operatorId` VARCHAR(191) NULL,
    `cameraCount` INTEGER NOT NULL DEFAULT 0,
    `camerasOperational` INTEGER NOT NULL DEFAULT 0,
    `inspectionDate` DATE NULL,
    `result` VARCHAR(191) NOT NULL DEFAULT 'NOT_INSPECTED',
    `findings` TEXT NULL,
    `responsibleParty` VARCHAR(191) NULL,
    `followUpAction` TEXT NULL,
    `nextDueOn` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    INDEX `inspection_operatorId_idx`(`operatorId`),
    INDEX `inspection_inspectionDate_idx`(`inspectionDate`),
    INDEX `inspection_result_idx`(`result`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incident` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NULL,
    `tripId` VARCHAR(191) NULL,
    `occurredOn` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `description` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REPORTED',
    `reportedBy` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `incident_reference_key`(`reference`),
    INDEX `incident_operatorId_idx`(`operatorId`),
    INDEX `incident_occurredOn_idx`(`occurredOn`),
    INDEX `incident_status_idx`(`status`),
    INDEX `incident_severity_idx`(`severity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trip` ADD CONSTRAINT `trip_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip` ADD CONSTRAINT `trip_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip` ADD CONSTRAINT `trip_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `passenger` ADD CONSTRAINT `passenger_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `operator`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incident` ADD CONSTRAINT `incident_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `operator`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incident` ADD CONSTRAINT `incident_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
