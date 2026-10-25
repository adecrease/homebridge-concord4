import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, Service } from 'homebridge';
import { type PartitionAccessoryContext } from './accessories/partitionAccessory';
import { type ZoneAccessoryContext } from './accessories/zoneAccessory';
import { type Concord4PlatformConfig, type ResolvedSensorType } from './settings';
type AnyAccessoryContext = PartitionAccessoryContext | ZoneAccessoryContext;
export interface EquipmentSnapshot {
    updatedAt: string;
    connected: boolean;
    connectionTarget: string;
    partitions: Array<{
        partitionNumber: number;
        name: string;
        armingLevel: number;
        armingLevelLabel: string;
        inAlarm: boolean;
        inTrouble: boolean;
        noDelay: boolean;
        chime: boolean;
        exposedInHomeKit: boolean;
    }>;
    zones: Array<{
        zoneNumber: number;
        partitionNumber: number;
        groupNumber: number;
        zoneType: number;
        zoneTypeLabel: string;
        name: string;
        inferredSensorType: ResolvedSensorType;
        resolvedSensorType: ResolvedSensorType;
        exposedInHomeKit: boolean;
        tripped: boolean;
        faulted: boolean;
        alarm: boolean;
        trouble: boolean;
        bypassed: boolean;
    }>;
}
export declare class Concord4Platform implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly config: Concord4PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory<AnyAccessoryContext>[];
    private readonly partitionHandlers;
    private readonly zoneHandlers;
    private readonly partitionConfigs;
    private readonly zoneConfigs;
    private client;
    private transport;
    private connectionTargetLabel;
    private snapshotTimer;
    constructor(log: Logging, config: Concord4PlatformConfig, api: API);
    /**
     * Restores cached accessories from disk at startup.
     */
    configureAccessory(accessory: PlatformAccessory): void;
    private initializeClient;
    private createTransport;
    private scheduleEquipmentSnapshotSave;
    private writeEquipmentSnapshot;
    private shouldExposePartition;
    private shouldExposeZone;
    private resolveZoneSensorType;
    private upsertPartitionAccessory;
    private upsertZoneAccessory;
    private pruneExcludedAccessories;
}
export {};
