"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcordClient = void 0;
const node_events_1 = require("node:events");
const constants_1 = require("./constants");
const frame_1 = require("./frame");
const parser_1 = require("./parser");
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
class ConcordClient extends node_events_1.EventEmitter {
    options;
    parser = new frame_1.ConcordFrameParser();
    partitions = new Map();
    zones = new Map();
    commandQueue = [];
    activeCommand = null;
    ackTimer = null;
    ackTimeoutMs;
    maxRetries;
    logger;
    constructor(options) {
        super();
        this.options = options;
        this.ackTimeoutMs = options.ackTimeoutMs ?? 1500;
        this.maxRetries = options.maxRetries ?? 3;
        this.logger = options.logger ?? {
            info: () => { },
            warn: () => { },
            error: () => { },
            debug: () => { },
        };
        this.bindTransportEvents();
    }
    getPartitions() {
        return Array.from(this.partitions.values()).sort((a, b) => a.partitionNumber - b.partitionNumber);
    }
    getPartition(partitionNumber) {
        return this.partitions.get(partitionNumber);
    }
    getZones() {
        return Array.from(this.zones.values()).sort((a, b) => a.zoneNumber - b.zoneNumber);
    }
    getZone(zoneNumber) {
        return this.zones.get(zoneNumber);
    }
    async start() {
        await this.options.transport.connect();
    }
    async stop() {
        this.clearAckTimer();
        while (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
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
    async requestEquipmentList() {
        await this.sendCommand([constants_1.ConcordCommand.EQUIPMENT_LIST_REQUEST]);
    }
    /**
     * Requests a dynamic state refresh from the panel (Command 0x20).
     */
    async requestDynamicDataRefresh() {
        await this.sendCommand([constants_1.ConcordCommand.CLEAR_AUTOMATION_IMAGE]);
    }
    /**
     * Arms the specified partition to Stay (Level 2) with standard entry/exit delay.
     */
    async armStay(partitionNumber = 1) {
        const partition = this.ensurePartition(partitionNumber);
        partition.noDelay = false;
        const keys = this.shouldUsePin()
            ? [constants_1.KeypressCode.DIGIT_2, ...(0, constants_1.pinToKeypressCodes)(this.options.pinCode)]
            : [constants_1.KeypressCode.KEYFOB_DIRECT_ARM_STAY];
        await this.sendKeypress(partitionNumber, keys);
    }
    /**
     * Arms the specified partition to Night mode (Stay Level 2 + Instant / No Entry Delay 0x04).
     */
    async armNight(partitionNumber = 1) {
        const partition = this.ensurePartition(partitionNumber);
        partition.noDelay = true;
        const keys = this.shouldUsePin()
            ? [
                constants_1.KeypressCode.DIGIT_2,
                ...(0, constants_1.pinToKeypressCodes)(this.options.pinCode),
                constants_1.KeypressCode.DIGIT_4_NO_DELAY,
            ]
            : [constants_1.KeypressCode.KEYFOB_DIRECT_ARM_STAY, constants_1.KeypressCode.DIGIT_4_NO_DELAY];
        await this.sendKeypress(partitionNumber, keys);
    }
    /**
     * Arms the specified partition to Away (Level 3).
     */
    async armAway(partitionNumber = 1) {
        const partition = this.ensurePartition(partitionNumber);
        partition.noDelay = false;
        const keys = this.shouldUsePin()
            ? [constants_1.KeypressCode.DIGIT_3, ...(0, constants_1.pinToKeypressCodes)(this.options.pinCode)]
            : [constants_1.KeypressCode.KEYFOB_DIRECT_ARM_AWAY];
        await this.sendKeypress(partitionNumber, keys);
    }
    /**
     * Disarms the specified partition (Level 1 / Off).
     */
    async disarm(partitionNumber = 1) {
        const partition = this.ensurePartition(partitionNumber);
        partition.noDelay = false;
        const keys = this.shouldUsePin()
            ? [constants_1.KeypressCode.DIGIT_1, ...(0, constants_1.pinToKeypressCodes)(this.options.pinCode)]
            : [constants_1.KeypressCode.KEYFOB_DISARM];
        await this.sendKeypress(partitionNumber, keys);
    }
    /**
     * Sends a sequence of simulated touchpad keypresses (Command 0x40) to a partition.
     */
    async sendKeypress(partitionNumber, keys, areaNumber = 0) {
        if (keys.length === 0) {
            return;
        }
        const payload = [constants_1.ConcordCommand.KEYPRESS, partitionNumber & 0xff, areaNumber & 0xff, ...keys];
        await this.sendCommand(payload);
    }
    /**
     * Queues a binary command payload `[CMD, ...DATA]` for transmission and resolves once ACKed.
     */
    sendCommand(payload) {
        const wireBuffer = (0, frame_1.encodeCommandFrame)(payload);
        return new Promise((resolve, reject) => {
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
    shouldUsePin() {
        return Boolean(this.options.usePinForArming &&
            this.options.pinCode &&
            this.options.pinCode.trim().length >= 4);
    }
    bindTransportEvents() {
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
        transport.on('data', (chunk) => {
            const tokens = this.parser.push(chunk);
            for (const token of tokens) {
                if (token.type === 'ack') {
                    if (this.options.debugProtocol) {
                        this.logger.debug('[RS-232 RX] <ACK 0x06>');
                    }
                    this.handleAck();
                }
                else if (token.type === 'nak') {
                    if (this.options.debugProtocol) {
                        this.logger.debug('[RS-232 RX] <NAK 0x15>');
                    }
                    this.handleNak();
                }
                else if (token.type === 'frame') {
                    const { frame } = token;
                    if (!frame.valid) {
                        this.logger.warn(`[RS-232 RX] Invalid frame (${frame.reason}): ${frame.rawHex} -> sending NAK`);
                        this.sendControlByte(constants_1.CONTROL_NAK);
                        continue;
                    }
                    if (this.options.debugProtocol) {
                        this.logger.debug(`[RS-232 RX] ${frame.rawHex}`);
                    }
                    // Immediately acknowledge valid frame from panel
                    this.sendControlByte(constants_1.CONTROL_ACK);
                    const parsed = (0, parser_1.parseConcordFrame)(frame.bytes);
                    this.handleParsedMessage(parsed);
                }
            }
        });
    }
    sendControlByte(byte) {
        if (!this.options.transport.isConnected()) {
            return;
        }
        this.options.transport.write(Buffer.from([byte])).catch((err) => {
            this.logger.error(`Failed to write control byte 0x${byte.toString(16)}: ${err.message}`);
        });
    }
    handleAck() {
        if (!this.activeCommand) {
            return;
        }
        this.clearAckTimer();
        const completed = this.activeCommand;
        this.activeCommand = null;
        completed.resolve();
        this.processQueue();
    }
    handleNak() {
        if (!this.activeCommand) {
            return;
        }
        this.clearAckTimer();
        this.retryOrFailActiveCommand('Received NAK (0x15) from panel');
    }
    processQueue() {
        if (this.activeCommand || this.commandQueue.length === 0) {
            return;
        }
        if (!this.options.transport.isConnected()) {
            return;
        }
        this.activeCommand = this.commandQueue.shift();
        this.transmitActiveCommand();
    }
    transmitActiveCommand() {
        if (!this.activeCommand) {
            return;
        }
        const cmd = this.activeCommand;
        cmd.attempts += 1;
        if (this.options.debugProtocol) {
            this.logger.debug(`[RS-232 TX] (attempt ${cmd.attempts}) ${cmd.wireBuffer.subarray(1).toString('ascii')}`);
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
    retryOrFailActiveCommand(reason) {
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
    clearAckTimer() {
        if (this.ackTimer) {
            clearTimeout(this.ackTimer);
            this.ackTimer = null;
        }
    }
    ensurePartition(partitionNumber, areaNumber = 0) {
        let partition = this.partitions.get(partitionNumber);
        if (!partition) {
            partition = {
                partitionNumber,
                areaNumber,
                name: `Partition ${partitionNumber}`,
                armingLevel: constants_1.ArmingLevel.OFF,
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
    handleParsedMessage(msg) {
        this.emit('message', msg);
        switch (msg.type) {
            case 'automationEventLost':
            case 'clearAutomationImage': {
                this.logger.info(`Panel reported ${msg.type}; requesting Dynamic Data Refresh (0x20)...`);
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
                this.logger.info(`Equipment list sync complete: ${this.partitions.size} partition(s), ${this.zones.size} zone(s). Requesting Dynamic Data Refresh (0x20)...`);
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
                if (msg.armingLevel === constants_1.ArmingLevel.OFF) {
                    partition.inAlarm = false;
                    partition.noDelay = false;
                }
                else if (msg.armingLevel === constants_1.ArmingLevel.NIGHT) {
                    partition.noDelay = true;
                }
                this.emit('partitionUpdated', { ...partition });
                break;
            }
            case 'zoneData': {
                const isNew = !this.zones.has(msg.zoneNumber);
                const existing = this.zones.get(msg.zoneNumber);
                const zoneName = msg.zoneName || existing?.name || `Zone ${msg.zoneNumber}`;
                const inferredSensorType = (0, constants_1.inferSensorType)(msg.groupNumber, zoneName);
                const zone = {
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
                const zone = {
                    zoneNumber: msg.zoneNumber,
                    partitionNumber: msg.partitionNumber,
                    areaNumber: msg.areaNumber,
                    groupNumber: existing?.groupNumber ?? 10,
                    zoneType: existing?.zoneType ?? constants_1.ZoneType.HARDWIRED,
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
                if (msg.armingLevel === constants_1.ArmingLevel.OFF) {
                    partition.inAlarm = false;
                    partition.noDelay = false;
                    partition.entryExitDelayActive = false;
                }
                else if (msg.armingLevel === constants_1.ArmingLevel.NIGHT) {
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
                if (msg.generalType === constants_1.AlarmGeneralType.ALARM) {
                    partition.inAlarm = true;
                    this.emit('partitionUpdated', { ...partition });
                }
                else if (msg.generalType === constants_1.AlarmGeneralType.ALARM_CANCEL ||
                    msg.generalType === constants_1.AlarmGeneralType.ALARM_RESTORAL ||
                    msg.generalType === constants_1.AlarmGeneralType.OPENING) {
                    partition.inAlarm = false;
                    this.emit('partitionUpdated', { ...partition });
                }
                else if (msg.generalType === constants_1.AlarmGeneralType.FIRE_TROUBLE ||
                    msg.generalType === constants_1.AlarmGeneralType.NON_FIRE_TROUBLE ||
                    msg.generalType === constants_1.AlarmGeneralType.SYSTEM_NON_FIRE_TROUBLE) {
                    partition.inTrouble = true;
                    this.emit('partitionUpdated', { ...partition });
                }
                else if (msg.generalType === constants_1.AlarmGeneralType.FIRE_TROUBLE_RESTORAL ||
                    msg.generalType === constants_1.AlarmGeneralType.NON_FIRE_TROUBLE_RESTORAL ||
                    msg.generalType === constants_1.AlarmGeneralType.SYSTEM_NON_FIRE_TROUBLE_RESTORAL) {
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
                if (partition.armingLevel === constants_1.ArmingLevel.STAY &&
                    /\bNO DELAY\b/i.test(msg.displayText)) {
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
exports.ConcordClient = ConcordClient;
//# sourceMappingURL=client.js.map