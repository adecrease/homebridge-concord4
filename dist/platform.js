"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Concord4Platform = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const partitionAccessory_1 = require("./accessories/partitionAccessory");
const zoneAccessory_1 = require("./accessories/zoneAccessory");
const client_1 = require("./concord/client");
const constants_1 = require("./concord/constants");
const transport_1 = require("./concord/transport");
const settings_1 = require("./settings");
class Concord4Platform {
    log;
    config;
    api;
    Service;
    Characteristic;
    accessories = [];
    partitionHandlers = new Map();
    zoneHandlers = new Map();
    partitionConfigs = new Map();
    zoneConfigs = new Map();
    client = null;
    transport = null;
    connectionTargetLabel = '';
    snapshotTimer = null;
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        for (const p of this.config.partitions ?? []) {
            if (typeof p.partitionNumber === 'number') {
                this.partitionConfigs.set(p.partitionNumber, p);
            }
        }
        for (const z of this.config.zones ?? []) {
            if (typeof z.zoneNumber === 'number') {
                this.zoneConfigs.set(z.zoneNumber, z);
            }
        }
        this.api.on('didFinishLaunching', () => {
            this.initializeClient();
        });
        this.api.on('shutdown', () => {
            if (this.snapshotTimer) {
                clearTimeout(this.snapshotTimer);
                this.snapshotTimer = null;
            }
            if (this.client) {
                this.client.stop().catch((err) => {
                    this.log.debug(`Error stopping ConcordClient on shutdown: ${err.message}`);
                });
            }
        });
    }
    /**
     * Restores cached accessories from disk at startup.
     */
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    initializeClient() {
        const transport = this.createTransport();
        if (!transport) {
            return;
        }
        this.transport = transport;
        const client = new client_1.ConcordClient({
            transport,
            logger: this.log,
            pinCode: this.config.pinCode,
            usePinForArming: this.config.usePinForArming ?? false,
            debugProtocol: this.config.debugProtocol ?? false,
        });
        this.client = client;
        client.on('connected', () => {
            this.scheduleEquipmentSnapshotSave();
        });
        client.on('disconnected', () => {
            this.scheduleEquipmentSnapshotSave();
        });
        client.on('partitionUpdated', (partition) => {
            if (this.shouldExposePartition(partition)) {
                this.upsertPartitionAccessory(partition);
            }
            this.scheduleEquipmentSnapshotSave();
        });
        client.on('zoneUpdated', (zone) => {
            if (this.shouldExposeZone(zone)) {
                this.upsertZoneAccessory(zone);
            }
            // If a zone belongs to a partition > 1, ensure that partition accessory is also exposed
            const parentPartition = client.getPartition(zone.partitionNumber);
            if (parentPartition && this.shouldExposePartition(parentPartition)) {
                this.upsertPartitionAccessory(parentPartition);
            }
            this.scheduleEquipmentSnapshotSave();
        });
        client.on('equipmentListComplete', () => {
            for (const partition of client.getPartitions()) {
                if (this.shouldExposePartition(partition)) {
                    this.upsertPartitionAccessory(partition);
                }
            }
            for (const zone of client.getZones()) {
                if (this.shouldExposeZone(zone)) {
                    this.upsertZoneAccessory(zone);
                }
            }
            this.pruneExcludedAccessories();
            this.scheduleEquipmentSnapshotSave();
        });
        client.start().catch((err) => {
            this.log.error(`Initial connection to Concord 4 panel failed (${err.message}). Will keep retrying in the background...`);
            this.scheduleEquipmentSnapshotSave();
        });
    }
    createTransport() {
        const connectionType = this.config.connectionType ?? 'serial';
        if (connectionType === 'tcp') {
            const host = this.config.tcpHost?.trim();
            const port = this.config.tcpPort ?? 2000;
            if (!host) {
                this.log.warn('Concord4Alarm is configured for TCP connection, but "tcpHost" is not set. Please configure the plugin in Homebridge.');
                return null;
            }
            this.connectionTargetLabel = `tcp://${host}:${port}`;
            this.log.info(`Connecting to Concord 4 RS-232 over TCP at ${host}:${port}...`);
            return new transport_1.TcpTransport({ host, port });
        }
        const serialPath = this.config.serialPort?.trim();
        const baudRate = this.config.baudRate ?? constants_1.DEFAULT_BAUD_RATE;
        if (!serialPath) {
            this.log.warn('Concord4Alarm is configured for Serial connection, but "serialPort" is not set. Please configure the plugin in Homebridge.');
            return null;
        }
        this.connectionTargetLabel = `${serialPath} (${baudRate} 8O1)`;
        this.log.info(`Connecting to Concord 4 RS-232 over Serial port ${serialPath} (${baudRate} 8O1)...`);
        return new transport_1.SerialTransport({
            path: serialPath,
            baudRate,
        });
    }
    scheduleEquipmentSnapshotSave() {
        if (this.snapshotTimer) {
            return;
        }
        this.snapshotTimer = setTimeout(() => {
            this.snapshotTimer = null;
            this.writeEquipmentSnapshot();
        }, 250);
    }
    writeEquipmentSnapshot() {
        if (!this.client) {
            return;
        }
        const armingLabelMap = {
            [constants_1.ArmingLevel.ZONE_TEST]: 'Zone Test',
            [constants_1.ArmingLevel.OFF]: 'Disarmed (Off)',
            [constants_1.ArmingLevel.STAY]: 'Armed Stay',
            [constants_1.ArmingLevel.AWAY]: 'Armed Away',
            [constants_1.ArmingLevel.NIGHT]: 'Armed Night',
            [constants_1.ArmingLevel.SILENT]: 'Armed Silent',
            [constants_1.ArmingLevel.PHONE_TEST]: 'Phone Test',
            [constants_1.ArmingLevel.SENSOR_TEST]: 'Sensor Test',
        };
        const zoneTypeLabelMap = {
            [constants_1.ZoneType.HARDWIRED]: 'Hardwired',
            [constants_1.ZoneType.RF]: 'Wireless RF',
            [constants_1.ZoneType.RF_TOUCHPAD]: 'RF Touchpad',
        };
        const snapshot = {
            updatedAt: new Date().toISOString(),
            connected: this.transport?.isConnected() ?? false,
            connectionTarget: this.connectionTargetLabel,
            partitions: this.client.getPartitions().map((p) => ({
                partitionNumber: p.partitionNumber,
                name: p.name,
                armingLevel: p.armingLevel,
                armingLevelLabel: p.armingLevel === constants_1.ArmingLevel.STAY && p.noDelay
                    ? 'Armed Night (Stay + No Delay)'
                    : armingLabelMap[p.armingLevel] ?? `Level ${p.armingLevel}`,
                inAlarm: p.inAlarm,
                inTrouble: p.inTrouble,
                noDelay: p.noDelay,
                chime: p.chime,
                exposedInHomeKit: this.shouldExposePartition(p),
            })),
            zones: this.client.getZones().map((z) => ({
                zoneNumber: z.zoneNumber,
                partitionNumber: z.partitionNumber,
                groupNumber: z.groupNumber,
                zoneType: z.zoneType,
                zoneTypeLabel: zoneTypeLabelMap[z.zoneType] ?? `Type ${z.zoneType}`,
                name: z.name,
                inferredSensorType: z.inferredSensorType,
                resolvedSensorType: this.resolveZoneSensorType(z),
                exposedInHomeKit: this.shouldExposeZone(z),
                tripped: z.tripped,
                faulted: z.faulted,
                alarm: z.alarm,
                trouble: z.trouble,
                bypassed: z.bypassed,
            })),
        };
        const payload = JSON.stringify(snapshot, null, 2);
        try {
            const storageFile = path.join(this.api.user.storagePath(), 'concord4-equipment.json');
            fs.writeFileSync(storageFile, payload, 'utf-8');
        }
        catch (err) {
            this.log.debug(`Could not write equipment snapshot to storagePath: ${String(err)}`);
        }
        try {
            const localFile = path.resolve(__dirname, '..', 'concord4-equipment.json');
            fs.writeFileSync(localFile, payload, 'utf-8');
        }
        catch {
            // Ignore if plugin folder is read-only
        }
    }
    shouldExposePartition(partition) {
        const cfg = this.partitionConfigs.get(partition.partitionNumber);
        if (cfg?.exclude) {
            return false;
        }
        if (cfg) {
            return true;
        }
        // If user configured an explicit partitions list, only expose those listed
        if (this.partitionConfigs.size > 0) {
            return false;
        }
        // Always expose Partition 1 by default
        if (partition.partitionNumber === 1) {
            return true;
        }
        // Expose Partition 2-6 if it has zones assigned to it or is actively armed
        const hasAssignedZones = (this.client?.getZones() ?? []).some((z) => z.partitionNumber === partition.partitionNumber);
        return hasAssignedZones || partition.armingLevel !== constants_1.ArmingLevel.OFF;
    }
    shouldExposeZone(zone) {
        const cfg = this.zoneConfigs.get(zone.zoneNumber);
        if (cfg?.exclude) {
            return false;
        }
        // Skip RF Touchpads unless explicitly configured by the user
        if (zone.zoneType === constants_1.ZoneType.RF_TOUCHPAD && !cfg) {
            return false;
        }
        const autoDiscover = this.config.autoDiscoverZones ?? true;
        if (!autoDiscover && !cfg) {
            return false;
        }
        return true;
    }
    resolveZoneSensorType(zone) {
        const cfg = this.zoneConfigs.get(zone.zoneNumber);
        if (cfg?.sensorType && cfg.sensorType !== 'auto') {
            return cfg.sensorType;
        }
        return zone.inferredSensorType;
    }
    upsertPartitionAccessory(partition) {
        if (!this.client) {
            return;
        }
        const existingHandler = this.partitionHandlers.get(partition.partitionNumber);
        if (existingHandler) {
            existingHandler.updateState(partition);
            return;
        }
        const cfg = this.partitionConfigs.get(partition.partitionNumber);
        const customName = cfg?.name?.trim() || undefined;
        const displayName = customName ||
            (partition.name !== `Partition ${partition.partitionNumber}`
                ? partition.name
                : this.config.name || `Partition ${partition.partitionNumber}`);
        const uuid = this.api.hap.uuid.generate(`concord4-partition-${partition.partitionNumber}`);
        let accessory = this.accessories.find((a) => a.UUID === uuid);
        if (accessory) {
            accessory.context = {
                kind: 'partition',
                partitionNumber: partition.partitionNumber,
                customName: displayName,
            };
            this.api.updatePlatformAccessories([accessory]);
        }
        else {
            this.log.info(`Registering new SecuritySystem accessory: ${displayName} (Partition ${partition.partitionNumber})`);
            accessory = new this.api.platformAccessory(displayName, uuid);
            accessory.context = {
                kind: 'partition',
                partitionNumber: partition.partitionNumber,
                customName: displayName,
            };
            this.accessories.push(accessory);
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        }
        const handler = new partitionAccessory_1.PartitionAccessoryHandler(this, accessory, this.client, partition);
        this.partitionHandlers.set(partition.partitionNumber, handler);
    }
    upsertZoneAccessory(zone) {
        const sensorType = this.resolveZoneSensorType(zone);
        const existingHandler = this.zoneHandlers.get(zone.zoneNumber);
        if (existingHandler && existingHandler.getSensorType() === sensorType) {
            existingHandler.updateState(zone);
            return;
        }
        const cfg = this.zoneConfigs.get(zone.zoneNumber);
        const customName = cfg?.name?.trim() || undefined;
        const displayName = customName || zone.name || `Zone ${zone.zoneNumber}`;
        const uuid = this.api.hap.uuid.generate(`concord4-zone-${zone.zoneNumber}`);
        let accessory = this.accessories.find((a) => a.UUID === uuid);
        if (accessory) {
            accessory.context = {
                kind: 'zone',
                zoneNumber: zone.zoneNumber,
                sensorType,
                customName,
            };
            this.api.updatePlatformAccessories([accessory]);
        }
        else {
            this.log.info(`Registering new ${sensorType} sensor accessory: ${displayName} (Zone ${zone.zoneNumber}, Group ${zone.groupNumber})`);
            accessory = new this.api.platformAccessory(displayName, uuid);
            accessory.context = {
                kind: 'zone',
                zoneNumber: zone.zoneNumber,
                sensorType,
                customName,
            };
            this.accessories.push(accessory);
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        }
        const handler = new zoneAccessory_1.ZoneAccessoryHandler(this, accessory, zone, sensorType);
        this.zoneHandlers.set(zone.zoneNumber, handler);
    }
    pruneExcludedAccessories() {
        const toRemove = [];
        for (const accessory of this.accessories) {
            const ctx = accessory.context;
            if (!ctx) {
                continue;
            }
            if (ctx.kind === 'partition') {
                const pCfg = this.partitionConfigs.get(ctx.partitionNumber);
                if (pCfg?.exclude) {
                    toRemove.push(accessory);
                    this.partitionHandlers.delete(ctx.partitionNumber);
                }
            }
            else if (ctx.kind === 'zone') {
                const zCfg = this.zoneConfigs.get(ctx.zoneNumber);
                const autoDiscover = this.config.autoDiscoverZones ?? true;
                if (zCfg?.exclude || (!autoDiscover && !zCfg)) {
                    toRemove.push(accessory);
                    this.zoneHandlers.delete(ctx.zoneNumber);
                }
            }
        }
        if (toRemove.length > 0) {
            for (const acc of toRemove) {
                this.log.info('Removing excluded accessory from cache:', acc.displayName);
                const idx = this.accessories.indexOf(acc);
                if (idx !== -1) {
                    this.accessories.splice(idx, 1);
                }
            }
            this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, toRemove);
        }
    }
}
exports.Concord4Platform = Concord4Platform;
//# sourceMappingURL=platform.js.map