import { EventEmitter } from 'node:events';
import type { ResolvedSensorType } from '../settings';
import {
  AlarmGeneralType,
  ArmingLevel,
  CONTROL_ACK,
  CONTROL_NAK,
  ConcordCommand,
  KeypressCode,
  ZoneType,
  inferSensorType,
  pinToKeypressCodes,
} from './constants';
import { ConcordFrameParser, encodeCommandFrame } from './frame';
import { type ConcordParsedMessage, parseConcordFrame } from './parser';
import type { ConcordTransport } from './transport';

export interface PartitionState {
  partitionNumber: number;
  areaNumber: number;
  name: string;
  armingLevel: ArmingLevel;
  inAlarm: boolean;
  inTrouble: boolean;
  noDelay: boolean;
  silentArming: boolean;
  chime: boolean;
  entryExitDelayActive: boolean;
  lastDisplayText: string;
}

export interface ZoneState {
  zoneNumber: number;
  partitionNumber: number;
  areaNumber: number;
  groupNumber: number;
  zoneType: ZoneType;
  name: string;
  inferredSensorType: ResolvedSensorType;
  tripped: boolean;
  faulted: boolean;
  alarm: boolean;
  trouble: boolean;
  bypassed: boolean;
}

export interface ConcordClientLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface ConcordClientOptions {
  transport: ConcordTransport;
  logger?: ConcordClientLogger;
  pinCode?: string;
  usePinForArming?: boolean;
  debugProtocol?: boolean;
  ackTimeoutMs?: number;
  maxRetries?: number;
}

interface QueuedCommand {
  payload: readonly number[];
  wireBuffer: Buffer;
  attempts: number;
  resolve: () => void;
  reject: (err: Error) => void;
}

/**
 * High-level event-driven client for the GE / Interlogix Concord 4 RS-232 Automation Module.
 *
 * Emits:
 * - `'connected'`: () => void
 * - `'disconnected'`: (reason?: string) => void
 * - `'equipmentListComplete'`: () => void
 * - `'partitionUpdated'`: (partition: PartitionState) => void
 * - `'zoneUpdated'`: (zone: ZoneState, isNew: boolean) => void
 * - `'message'`: (msg: ConcordParsedMessage) => void
 */
export class ConcordClient extends EventEmitter {
  private readonly parser = new ConcordFrameParser();
  private readonly partitions = new Map<number, PartitionState>();
  private readonly zones = new Map<number, ZoneState>();
  private readonly commandQueue: QueuedCommand[] = [];
  private activeCommand: QueuedCommand | null = null;
  private ackTimer: NodeJS.Timeout | null = null;
  private readonly ackTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly logger: ConcordClientLogger;

  constructor(private readonly options: ConcordClientOptions) {
    super();
    this.ackTimeoutMs = options.ackTimeoutMs ?? 1500;
    this.maxRetries = options.maxRetries ?? 3;
    this.logger = options.logger ?? {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    this.bindTransportEvents();
  }

  public getPartitions(): PartitionState[] {
    return Array.from(this.partitions.values()).sort(
      (a, b) => a.partitionNumber - b.partitionNumber,
    );
  }

  public getPartition(partitionNumber: number): PartitionState | undefined {
    return this.partitions.get(partitionNumber);
  }

  public getZones(): ZoneState[] {
    return Array.from(this.zones.values()).sort((a, b) => a.zoneNumber - b.zoneNumber);
  }

  public getZone(zoneNumber: number): ZoneState | undefined {
    return this.zones.get(zoneNumber);
  }

  public async start(): Promise<void> {
    await this.options.transport.connect();
  }

  public async stop(): Promise<void> {
    this.clearAckTimer();
    while (this.commandQueue.length > 0) {
      const cmd = this.commandQueue.shift()!;
      cmd.reject(new Error('ConcordClient stopped'));
    }
    if (this.activeCommand) {
      const active = this.activeCommand;
      this.activeCommand = null;
      active.reject(new Error('ConcordClient stopped'));
    }
    await this.options.transport.disconnect();
  }

  /**
   * Requests the full equipment list (zones, partitions, users, etc.) from the panel (Command 0x02).
   */
  public async requestEquipmentList(): Promise<void> {
    await this.sendCommand([ConcordCommand.EQUIPMENT_LIST_REQUEST]);
  }

  /**
   * Requests a dynamic state refresh from the panel (Command 0x20).
   */
  public async requestDynamicDataRefresh(): Promise<void> {
    await this.sendCommand([ConcordCommand.CLEAR_AUTOMATION_IMAGE]);
  }

  /**
   * Arms the specified partition to Stay (Level 2) with standard entry/exit delay.
   */
  public async armStay(partitionNumber = 1): Promise<void> {
    const partition = this.ensurePartition(partitionNumber);
    partition.noDelay = false;

    const keys = this.shouldUsePin()
      ? [KeypressCode.DIGIT_2, ...pinToKeypressCodes(this.options.pinCode!)]
      : [KeypressCode.KEYFOB_DIRECT_ARM_STAY];

    await this.sendKeypress(partitionNumber, keys);
  }

  /**
   * Arms the specified partition to Night mode (Stay Level 2 + Instant / No Entry Delay 0x04).
   */
  public async armNight(partitionNumber = 1): Promise<void> {
    const partition = this.ensurePartition(partitionNumber);
    partition.noDelay = true;

    const keys = this.shouldUsePin()
      ? [
          KeypressCode.DIGIT_2,
          ...pinToKeypressCodes(this.options.pinCode!),
          KeypressCode.DIGIT_4_NO_DELAY,
        ]
      : [KeypressCode.KEYFOB_DIRECT_ARM_STAY, KeypressCode.DIGIT_4_NO_DELAY];

    await this.sendKeypress(partitionNumber, keys);
  }

  /**
   * Arms the specified partition to Away (Level 3).
   */
  public async armAway(partitionNumber = 1): Promise<void> {
    const partition = this.ensurePartition(partitionNumber);
    partition.noDelay = false;

    const keys = this.shouldUsePin()
      ? [KeypressCode.DIGIT_3, ...pinToKeypressCodes(this.options.pinCode!)]
      : [KeypressCode.KEYFOB_DIRECT_ARM_AWAY];

    await this.sendKeypress(partitionNumber, keys);
  }

  /**
   * Disarms the specified partition (Level 1 / Off).
   */
  public async disarm(partitionNumber = 1): Promise<void> {
    const partition = this.ensurePartition(partitionNumber);
    partition.noDelay = false;

    const keys = this.shouldUsePin()
      ? [KeypressCode.DIGIT_1, ...pinToKeypressCodes(this.options.pinCode!)]
      : [KeypressCode.KEYFOB_DISARM];

    await this.sendKeypress(partitionNumber, keys);
  }

  /**
   * Sends a sequence of simulated touchpad keypresses (Command 0x40) to a partition.
   */
  public async sendKeypress(
    partitionNumber: number,
    keys: readonly number[],
    areaNumber = 0,
  ): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const payload = [ConcordCommand.KEYPRESS, partitionNumber & 0xff, areaNumber & 0xff, ...keys];
    await this.sendCommand(payload);
  }

  /**
   * Queues a binary command payload `[CMD, ...DATA]` for transmission and resolves once ACKed.
   */
  public sendCommand(payload: readonly number[]): Promise<void> {
    const wireBuffer = encodeCommandFrame(payload);
    return new Promise<void>((resolve, reject) => {
      this.commandQueue.push({
        payload,
        wireBuffer,
        attempts: 0,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  private shouldUsePin(): boolean {
    return Boolean(
      this.options.usePinForArming &&
        this.options.pinCode &&
        this.options.pinCode.trim().length >= 4,
    );
  }

  private bindTransportEvents(): void {
    const { transport } = this.options;

    transport.on('connected', () => {
      this.parser.resetFrame();
      this.logger.info('Connected to Concord RS-232 interface. Syncing equipment and state...');
      this.emit('connected');

      // Request full equipment list first; Dynamic Data Refresh (0x20) is requested
      // once the panel finishes streaming and sends Equipment List Complete (0x08).
      this.requestEquipmentList().catch((err) => {
        this.logger.warn(`Initial Equipment List request failed: ${err.message}`);
      });
    });

    transport.on('disconnected', (reason) => {
      this.logger.warn(`Concord RS-232 interface disconnected${reason ? `: ${reason}` : ''}`);
      this.emit('disconnected', reason);
    });

    transport.on('error', (err) => {
      this.logger.error(`Concord transport error: ${err.message}`);
    });

    transport.on('data', (chunk: Buffer) => {
      const tokens = this.parser.push(chunk);
      for (const token of tokens) {
        if (token.type === 'ack') {
          if (this.options.debugProtocol) {
            this.logger.debug('[RS-232 RX] <ACK 0x06>');
          }
          this.handleAck();
        } else if (token.type === 'nak') {
          if (this.options.debugProtocol) {
            this.logger.debug('[RS-232 RX] <NAK 0x15>');
          }
          this.handleNak();
        } else if (token.type === 'frame') {
          const { frame } = token;
          if (!frame.valid) {
            this.logger.warn(
              `[RS-232 RX] Invalid frame (${frame.reason}): ${frame.rawHex} -> sending NAK`,
            );
            this.sendControlByte(CONTROL_NAK);
            continue;
          }

          if (this.options.debugProtocol) {
            this.logger.debug(`[RS-232 RX] ${frame.rawHex}`);
          }

          // Immediately acknowledge valid frame from panel
          this.sendControlByte(CONTROL_ACK);

          const parsed = parseConcordFrame(frame.bytes);
          this.handleParsedMessage(parsed);
        }
      }
    });
  }

  private sendControlByte(byte: number): void {
    if (!this.options.transport.isConnected()) {
      return;
    }
    this.options.transport.write(Buffer.from([byte])).catch((err) => {
      this.logger.error(`Failed to write control byte 0x${byte.toString(16)}: ${err.message}`);
    });
  }

  private handleAck(): void {
    if (!this.activeCommand) {
      return;
    }
    this.clearAckTimer();
    const completed = this.activeCommand;
    this.activeCommand = null;
    completed.resolve();
    this.processQueue();
  }

  private handleNak(): void {
    if (!this.activeCommand) {
      return;
    }
    this.clearAckTimer();
    this.retryOrFailActiveCommand('Received NAK (0x15) from panel');
  }

  private processQueue(): void {
    if (this.activeCommand || this.commandQueue.length === 0) {
      return;
    }
    if (!this.options.transport.isConnected()) {
      return;
    }

    this.activeCommand = this.commandQueue.shift()!;
    this.transmitActiveCommand();
  }

  private transmitActiveCommand(): void {
    if (!this.activeCommand) {
      return;
    }

    const cmd = this.activeCommand;
    cmd.attempts += 1;

    if (this.options.debugProtocol) {
      this.logger.debug(
        `[RS-232 TX] (attempt ${cmd.attempts}) ${cmd.wireBuffer.subarray(1).toString('ascii')}`,
      );
    }

    this.clearAckTimer();
    this.ackTimer = setTimeout(() => {
      this.ackTimer = null;
      this.retryOrFailActiveCommand(`ACK timeout after ${this.ackTimeoutMs}ms`);
    }, this.ackTimeoutMs);

    this.options.transport.write(cmd.wireBuffer).catch((err) => {
      this.clearAckTimer();
      this.retryOrFailActiveCommand(`Write error: ${err.message}`);
    });
  }

  private retryOrFailActiveCommand(reason: string): void {
    const cmd = this.activeCommand;
    if (!cmd) {
      return;
    }

    if (cmd.attempts < this.maxRetries && this.options.transport.isConnected()) {
      this.logger.warn(`${reason}; retrying command (${cmd.attempts}/${this.maxRetries})...`);
      this.transmitActiveCommand();
      return;
    }

    this.activeCommand = null;
    cmd.reject(new Error(`Concord command failed after ${cmd.attempts} attempts: ${reason}`));
    this.processQueue();
  }

  private clearAckTimer(): void {
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
      this.ackTimer = null;
    }
  }

  private ensurePartition(partitionNumber: number, areaNumber = 0): PartitionState {
    let partition = this.partitions.get(partitionNumber);
    if (!partition) {
      partition = {
        partitionNumber,
        areaNumber,
        name: `Partition ${partitionNumber}`,
        armingLevel: ArmingLevel.OFF,
        inAlarm: false,
        inTrouble: false,
        noDelay: false,
        silentArming: false,
        chime: false,
        entryExitDelayActive: false,
        lastDisplayText: '',
      };
      this.partitions.set(partitionNumber, partition);
    }
    return partition;
  }

  private handleParsedMessage(msg: ConcordParsedMessage): void {
    this.emit('message', msg);

    switch (msg.type) {
      case 'automationEventLost':
      case 'clearAutomationImage': {
        this.logger.info(
          `Panel reported ${msg.type}; requesting Dynamic Data Refresh (0x20)...`,
        );
        this.requestDynamicDataRefresh().catch((err) => {
          this.logger.warn(`Failed to refresh dynamic data: ${err.message}`);
        });
        break;
      }

      case 'equipmentListComplete': {
        // Ensure Partition 1 exists if the panel didn't emit any Partition Data records
        if (this.partitions.size === 0) {
          this.ensurePartition(1);
        }
        this.logger.info(
          `Equipment list sync complete: ${this.partitions.size} partition(s), ${this.zones.size} zone(s). Requesting Dynamic Data Refresh (0x20)...`,
        );
        this.emit('equipmentListComplete');
        this.requestDynamicDataRefresh().catch((err) => {
          this.logger.warn(`Dynamic Data Refresh after Equipment List failed: ${err.message}`);
        });
        break;
      }

      case 'partitionData': {
        // Concord panels often send all 6 partitions during Equipment List; only track Partition 1
        // or partitions that are armed/named unless zones belong to them
        const partition = this.ensurePartition(msg.partitionNumber, msg.areaNumber);
        if (msg.partitionName && msg.partitionName !== `Partition ${msg.partitionNumber}`) {
          partition.name = msg.partitionName;
        }
        partition.armingLevel = msg.armingLevel;
        if (msg.armingLevel === ArmingLevel.OFF) {
          partition.inAlarm = false;
          partition.noDelay = false;
        } else if (msg.armingLevel === ArmingLevel.NIGHT) {
          partition.noDelay = true;
        }
        this.emit('partitionUpdated', { ...partition });
        break;
      }

      case 'zoneData': {
        const isNew = !this.zones.has(msg.zoneNumber);
        const existing = this.zones.get(msg.zoneNumber);
        const zoneName = msg.zoneName || existing?.name || `Zone ${msg.zoneNumber}`;
        const inferredSensorType = inferSensorType(msg.groupNumber, zoneName);

        const zone: ZoneState = {
          zoneNumber: msg.zoneNumber,
          partitionNumber: msg.partitionNumber,
          areaNumber: msg.areaNumber,
          groupNumber: msg.groupNumber,
          zoneType: msg.zoneType,
          name: zoneName,
          inferredSensorType,
          tripped: msg.state.tripped,
          faulted: msg.state.faulted,
          alarm: msg.state.alarm,
          trouble: msg.state.trouble,
          bypassed: msg.state.bypassed,
        };

        this.zones.set(msg.zoneNumber, zone);
        this.ensurePartition(msg.partitionNumber, msg.areaNumber);
        this.emit('zoneUpdated', { ...zone }, isNew);
        break;
      }

      case 'zoneStatus': {
        const isNew = !this.zones.has(msg.zoneNumber);
        const existing = this.zones.get(msg.zoneNumber);

        const zone: ZoneState = {
          zoneNumber: msg.zoneNumber,
          partitionNumber: msg.partitionNumber,
          areaNumber: msg.areaNumber,
          groupNumber: existing?.groupNumber ?? 10,
          zoneType: existing?.zoneType ?? ZoneType.HARDWIRED,
          name: existing?.name ?? `Zone ${msg.zoneNumber}`,
          inferredSensorType: existing?.inferredSensorType ?? 'contact',
          tripped: msg.state.tripped,
          faulted: msg.state.faulted,
          alarm: msg.state.alarm,
          trouble: msg.state.trouble,
          bypassed: msg.state.bypassed,
        };

        this.zones.set(msg.zoneNumber, zone);

        // If any zone enters alarm state, also mark its partition as inAlarm
        if (zone.alarm) {
          const partition = this.ensurePartition(msg.partitionNumber, msg.areaNumber);
          if (!partition.inAlarm) {
            partition.inAlarm = true;
            this.emit('partitionUpdated', { ...partition });
          }
        }

        this.emit('zoneUpdated', { ...zone }, isNew);
        break;
      }

      case 'armingLevel': {
        const partition = this.ensurePartition(msg.partitionNumber, msg.areaNumber);
        partition.armingLevel = msg.armingLevel;

        if (msg.armingLevel === ArmingLevel.OFF) {
          partition.inAlarm = false;
          partition.noDelay = false;
          partition.entryExitDelayActive = false;
        } else if (msg.armingLevel === ArmingLevel.NIGHT) {
          partition.noDelay = true;
        }

        this.emit('partitionUpdated', { ...partition });
        break;
      }

      case 'featureState': {
        const partition = this.ensurePartition(msg.partitionNumber, msg.areaNumber);
        partition.chime = msg.features.chime;
        partition.noDelay = msg.features.noDelay;
        partition.silentArming = msg.features.silentArming;
        this.emit('partitionUpdated', { ...partition });
        break;
      }

      case 'alarmTrouble': {
        const partition = this.ensurePartition(msg.partitionNumber, msg.areaNumber);
        if (msg.generalType === AlarmGeneralType.ALARM) {
          partition.inAlarm = true;
          this.emit('partitionUpdated', { ...partition });
        } else if (
          msg.generalType === AlarmGeneralType.ALARM_CANCEL ||
          msg.generalType === AlarmGeneralType.ALARM_RESTORAL ||
          msg.generalType === AlarmGeneralType.OPENING
        ) {
          partition.inAlarm = false;
          this.emit('partitionUpdated', { ...partition });
        } else if (
          msg.generalType === AlarmGeneralType.FIRE_TROUBLE ||
          msg.generalType === AlarmGeneralType.NON_FIRE_TROUBLE ||
          msg.generalType === AlarmGeneralType.SYSTEM_NON_FIRE_TROUBLE
        ) {
          partition.inTrouble = true;
          this.emit('partitionUpdated', { ...partition });
        } else if (
          msg.generalType === AlarmGeneralType.FIRE_TROUBLE_RESTORAL ||
          msg.generalType === AlarmGeneralType.NON_FIRE_TROUBLE_RESTORAL ||
          msg.generalType === AlarmGeneralType.SYSTEM_NON_FIRE_TROUBLE_RESTORAL
        ) {
          partition.inTrouble = false;
          this.emit('partitionUpdated', { ...partition });
        }
        break;
      }

      case 'entryExitDelay': {
        const partition = this.ensurePartition(msg.partitionNumber, msg.areaNumber);
        partition.entryExitDelayActive = !msg.isEndDelay;
        this.emit('partitionUpdated', { ...partition });
        break;
      }

      case 'touchpadDisplay': {
        const partition = this.ensurePartition(msg.partitionNumber, msg.areaNumber);
        partition.lastDisplayText = msg.displayText;
        // If touchpad explicitly displays NO DELAY while armed to Stay, reflect it
        if (
          partition.armingLevel === ArmingLevel.STAY &&
          /\bNO DELAY\b/i.test(msg.displayText)
        ) {
          if (!partition.noDelay) {
            partition.noDelay = true;
            this.emit('partitionUpdated', { ...partition });
          }
        }
        break;
      }

      default:
        break;
    }
  }
}
