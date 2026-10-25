import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  Service,
} from 'homebridge';
import {
  type PartitionAccessoryContext,
  PartitionAccessoryHandler,
} from './accessories/partitionAccessory';
import {
  type ZoneAccessoryContext,
  ZoneAccessoryHandler,
} from './accessories/zoneAccessory';
import {
  ConcordClient,
  type PartitionState,
  type ZoneState,
} from './concord/client';
import { ArmingLevel, DEFAULT_BAUD_RATE, ZoneType } from './concord/constants';
import {
  type ConcordTransport,
  SerialTransport,
  TcpTransport,
} from './concord/transport';
import {
  type Concord4PlatformConfig,
  PLATFORM_NAME,
  PLUGIN_NAME,
  type PartitionConfigItem,
  type ResolvedSensorType,
  type ZoneConfigItem,
} from './settings';

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

export class Concord4Platform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: PlatformAccessory<AnyAccessoryContext>[] = [];

  private readonly partitionHandlers = new Map<number, PartitionAccessoryHandler>();
  private readonly zoneHandlers = new Map<number, ZoneAccessoryHandler>();
  private readonly partitionConfigs = new Map<number, PartitionConfigItem>();
  private readonly zoneConfigs = new Map<number, ZoneConfigItem>();
  private client: ConcordClient | null = null;
  private transport: ConcordTransport | null = null;
  private connectionTargetLabel = '';
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly log: Logging,
    public readonly config: Concord4PlatformConfig,
    public readonly api: API,
  ) {
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
  public configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory as PlatformAccessory<AnyAccessoryContext>);
  }

  private initializeClient(): void {
    const transport = this.createTransport();
    if (!transport) {
      return;
    }

    this.transport = transport;

    const client = new ConcordClient({
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

    client.on('partitionUpdated', (partition: PartitionState) => {
      if (this.shouldExposePartition(partition)) {
        this.upsertPartitionAccessory(partition);
      }
      this.scheduleEquipmentSnapshotSave();
    });

    client.on('zoneUpdated', (zone: ZoneState) => {
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
      this.log.error(
        `Initial connection to Concord 4 panel failed (${err.message}). Will keep retrying in the background...`,
      );
      this.scheduleEquipmentSnapshotSave();
    });
  }

  private createTransport(): ConcordTransport | null {
    const connectionType = this.config.connectionType ?? 'serial';

    if (connectionType === 'tcp') {
      const host = this.config.tcpHost?.trim();
      const port = this.config.tcpPort ?? 2000;
      if (!host) {
        this.log.warn(
          'Concord4Alarm is configured for TCP connection, but "tcpHost" is not set. Please configure the plugin in Homebridge.',
        );
        return null;
      }
      this.connectionTargetLabel = `tcp://${host}:${port}`;
      this.log.info(`Connecting to Concord 4 RS-232 over TCP at ${host}:${port}...`);
      return new TcpTransport({ host, port });
    }

    const serialPath = this.config.serialPort?.trim();
    const baudRate = this.config.baudRate ?? DEFAULT_BAUD_RATE;
    if (!serialPath) {
      this.log.warn(
        'Concord4Alarm is configured for Serial connection, but "serialPort" is not set. Please configure the plugin in Homebridge.',
      );
      return null;
    }

    this.connectionTargetLabel = `${serialPath} (${baudRate} 8O1)`;
    this.log.info(
      `Connecting to Concord 4 RS-232 over Serial port ${serialPath} (${baudRate} 8O1)...`,
    );
    return new SerialTransport({
      path: serialPath,
      baudRate,
    });
  }

  private scheduleEquipmentSnapshotSave(): void {
    if (this.snapshotTimer) {
      return;
    }
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      this.writeEquipmentSnapshot();
    }, 250);
  }

  private writeEquipmentSnapshot(): void {
    if (!this.client) {
      return;
    }

    const armingLabelMap: Record<number, string> = {
      [ArmingLevel.ZONE_TEST]: 'Zone Test',
      [ArmingLevel.OFF]: 'Disarmed (Off)',
      [ArmingLevel.STAY]: 'Armed Stay',
      [ArmingLevel.AWAY]: 'Armed Away',
      [ArmingLevel.NIGHT]: 'Armed Night',
      [ArmingLevel.SILENT]: 'Armed Silent',
      [ArmingLevel.PHONE_TEST]: 'Phone Test',
      [ArmingLevel.SENSOR_TEST]: 'Sensor Test',
    };

    const zoneTypeLabelMap: Record<number, string> = {
      [ZoneType.HARDWIRED]: 'Hardwired',
      [ZoneType.RF]: 'Wireless RF',
      [ZoneType.RF_TOUCHPAD]: 'RF Touchpad',
    };

    const snapshot: EquipmentSnapshot = {
      updatedAt: new Date().toISOString(),
      connected: this.transport?.isConnected() ?? false,
      connectionTarget: this.connectionTargetLabel,
      partitions: this.client.getPartitions().map((p) => ({
        partitionNumber: p.partitionNumber,
        name: p.name,
        armingLevel: p.armingLevel,
        armingLevelLabel:
          p.armingLevel === ArmingLevel.STAY && p.noDelay
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
      const storageFile = path.join(
        this.api.user.storagePath(),
        'concord4-equipment.json',
      );
      fs.writeFileSync(storageFile, payload, 'utf-8');
    } catch (err) {
      this.log.debug(`Could not write equipment snapshot to storagePath: ${String(err)}`);
    }

    try {
      const localFile = path.resolve(__dirname, '..', 'concord4-equipment.json');
      fs.writeFileSync(localFile, payload, 'utf-8');
    } catch {
      // Ignore if plugin folder is read-only
    }
  }

  private shouldExposePartition(partition: PartitionState): boolean {
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
    const hasAssignedZones = (this.client?.getZones() ?? []).some(
      (z) => z.partitionNumber === partition.partitionNumber,
    );
    return hasAssignedZones || partition.armingLevel !== ArmingLevel.OFF;
  }

  private shouldExposeZone(zone: ZoneState): boolean {
    const cfg = this.zoneConfigs.get(zone.zoneNumber);
    if (cfg?.exclude) {
      return false;
    }

    // Skip RF Touchpads unless explicitly configured by the user
    if (zone.zoneType === ZoneType.RF_TOUCHPAD && !cfg) {
      return false;
    }

    const autoDiscover = this.config.autoDiscoverZones ?? true;
    if (!autoDiscover && !cfg) {
      return false;
    }

    return true;
  }

  private resolveZoneSensorType(zone: ZoneState): ResolvedSensorType {
    const cfg = this.zoneConfigs.get(zone.zoneNumber);
    if (cfg?.sensorType && cfg.sensorType !== 'auto') {
      return cfg.sensorType;
    }
    return zone.inferredSensorType;
  }

  private upsertPartitionAccessory(partition: PartitionState): void {
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
    const displayName =
      customName ||
      (partition.name !== `Partition ${partition.partitionNumber}`
        ? partition.name
        : this.config.name || `Partition ${partition.partitionNumber}`);

    const uuid = this.api.hap.uuid.generate(
      `concord4-partition-${partition.partitionNumber}`,
    );
    let accessory = this.accessories.find((a) => a.UUID === uuid) as
      | PlatformAccessory<PartitionAccessoryContext>
      | undefined;

    if (accessory) {
      accessory.context = {
        kind: 'partition',
        partitionNumber: partition.partitionNumber,
        customName: displayName,
      };
      this.api.updatePlatformAccessories([accessory]);
    } else {
      this.log.info(
        `Registering new SecuritySystem accessory: ${displayName} (Partition ${partition.partitionNumber})`,
      );
      accessory = new this.api.platformAccessory<PartitionAccessoryContext>(
        displayName,
        uuid,
      );
      accessory.context = {
        kind: 'partition',
        partitionNumber: partition.partitionNumber,
        customName: displayName,
      };
      this.accessories.push(accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    const handler = new PartitionAccessoryHandler(
      this,
      accessory,
      this.client,
      partition,
    );
    this.partitionHandlers.set(partition.partitionNumber, handler);
  }

  private upsertZoneAccessory(zone: ZoneState): void {
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
    let accessory = this.accessories.find((a) => a.UUID === uuid) as
      | PlatformAccessory<ZoneAccessoryContext>
      | undefined;

    if (accessory) {
      accessory.context = {
        kind: 'zone',
        zoneNumber: zone.zoneNumber,
        sensorType,
        customName,
      };
      this.api.updatePlatformAccessories([accessory]);
    } else {
      this.log.info(
        `Registering new ${sensorType} sensor accessory: ${displayName} (Zone ${zone.zoneNumber}, Group ${zone.groupNumber})`,
      );
      accessory = new this.api.platformAccessory<ZoneAccessoryContext>(
        displayName,
        uuid,
      );
      accessory.context = {
        kind: 'zone',
        zoneNumber: zone.zoneNumber,
        sensorType,
        customName,
      };
      this.accessories.push(accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    const handler = new ZoneAccessoryHandler(this, accessory, zone, sensorType);
    this.zoneHandlers.set(zone.zoneNumber, handler);
  }

  private pruneExcludedAccessories(): void {
    const toRemove: PlatformAccessory<AnyAccessoryContext>[] = [];

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
      } else if (ctx.kind === 'zone') {
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
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRemove);
    }
  }
}
