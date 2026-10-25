import { EventEmitter } from 'node:events';
import type { ResolvedSensorType } from '../settings';
import { ArmingLevel, ZoneType } from './constants';
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
export declare class ConcordClient extends EventEmitter {
    private readonly options;
    private readonly parser;
    private readonly partitions;
    private readonly zones;
    private readonly commandQueue;
    private activeCommand;
    private ackTimer;
    private readonly ackTimeoutMs;
    private readonly maxRetries;
    private readonly logger;
    constructor(options: ConcordClientOptions);
    getPartitions(): PartitionState[];
    getPartition(partitionNumber: number): PartitionState | undefined;
    getZones(): ZoneState[];
    getZone(zoneNumber: number): ZoneState | undefined;
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Requests the full equipment list (zones, partitions, users, etc.) from the panel (Command 0x02).
     */
    requestEquipmentList(): Promise<void>;
    /**
     * Requests a dynamic state refresh from the panel (Command 0x20).
     */
    requestDynamicDataRefresh(): Promise<void>;
    /**
     * Arms the specified partition to Stay (Level 2) with standard entry/exit delay.
     */
    armStay(partitionNumber?: number): Promise<void>;
    /**
     * Arms the specified partition to Night mode (Stay Level 2 + Instant / No Entry Delay 0x04).
     */
    armNight(partitionNumber?: number): Promise<void>;
    /**
     * Arms the specified partition to Away (Level 3).
     */
    armAway(partitionNumber?: number): Promise<void>;
    /**
     * Disarms the specified partition (Level 1 / Off).
     */
    disarm(partitionNumber?: number): Promise<void>;
    /**
     * Sends a sequence of simulated touchpad keypresses (Command 0x40) to a partition.
     */
    sendKeypress(partitionNumber: number, keys: readonly number[], areaNumber?: number): Promise<void>;
    /**
     * Queues a binary command payload `[CMD, ...DATA]` for transmission and resolves once ACKed.
     */
    sendCommand(payload: readonly number[]): Promise<void>;
    private shouldUsePin;
    private bindTransportEvents;
    private sendControlByte;
    private handleAck;
    private handleNak;
    private processQueue;
    private transmitActiveCommand;
    private retryOrFailActiveCommand;
    private clearAckTimer;
    private ensurePartition;
    private handleParsedMessage;
}
