"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseZoneState = parseZoneState;
exports.parseFeatureState = parseFeatureState;
exports.parseConcordFrame = parseConcordFrame;
const constants_1 = require("./constants");
function parseZoneState(mask) {
    return {
        raw: mask,
        tripped: (mask & constants_1.ZoneStateFlags.TRIPPED) !== 0,
        faulted: (mask & constants_1.ZoneStateFlags.FAULTED) !== 0,
        alarm: (mask & constants_1.ZoneStateFlags.ALARM) !== 0,
        trouble: (mask & constants_1.ZoneStateFlags.TROUBLE) !== 0,
        bypassed: (mask & constants_1.ZoneStateFlags.BYPASSED) !== 0,
    };
}
function parseFeatureState(mask) {
    return {
        raw: mask,
        chime: (mask & constants_1.FeatureStateFlags.CHIME) !== 0,
        energySaver: (mask & constants_1.FeatureStateFlags.ENERGY_SAVER) !== 0,
        noDelay: (mask & constants_1.FeatureStateFlags.NO_DELAY) !== 0,
        latchkey: (mask & constants_1.FeatureStateFlags.LATCHKEY) !== 0,
        silentArming: (mask & constants_1.FeatureStateFlags.SILENT_ARMING) !== 0,
        quickArm: (mask & constants_1.FeatureStateFlags.QUICK_ARM) !== 0,
    };
}
/**
 * Parses a validated binary Concord frame `[LI, CMD, ...DATA, CS]` into a typed message object.
 */
function parseConcordFrame(bytes) {
    if (bytes.length < 3) {
        return {
            type: 'unknown',
            commandId: bytes[1] ?? -1,
            bytes,
        };
    }
    const commandId = bytes[1];
    switch (commandId) {
        case constants_1.ConcordCommand.EQUIPMENT_LIST_REQUEST:
            return { type: 'automationEventLost' };
        case constants_1.ConcordCommand.EQUIPMENT_LIST_COMPLETE:
            return { type: 'equipmentListComplete' };
        case constants_1.ConcordCommand.CLEAR_AUTOMATION_IMAGE:
            return { type: 'clearAutomationImage' };
        case constants_1.ConcordCommand.ZONE_DATA: {
            if (bytes.length < 10) {
                break;
            }
            const partitionNumber = bytes[2];
            const areaNumber = bytes[3];
            const groupNumber = bytes[4];
            const zoneNumber = (bytes[5] << 8) | bytes[6];
            const zoneType = bytes[7];
            const state = parseZoneState(bytes[8]);
            const textTokens = bytes.slice(9, bytes.length - 1);
            const decodedName = (0, constants_1.decodeTextTokens)(textTokens, true);
            return {
                type: 'zoneData',
                partitionNumber,
                areaNumber,
                groupNumber,
                zoneNumber,
                zoneType,
                state,
                zoneName: decodedName || `Zone ${zoneNumber}`,
            };
        }
        case constants_1.ConcordCommand.PARTITION_DATA: {
            if (bytes.length < 6) {
                break;
            }
            const partitionNumber = bytes[2];
            const areaNumber = bytes[3];
            const armingLevel = bytes[4];
            const textTokens = bytes.slice(5, bytes.length - 1);
            const decodedName = (0, constants_1.decodeTextTokens)(textTokens, true);
            return {
                type: 'partitionData',
                partitionNumber,
                areaNumber,
                armingLevel,
                partitionName: decodedName || `Partition ${partitionNumber}`,
            };
        }
        case constants_1.ConcordCommand.ZONE_STATUS: {
            if (bytes.length < 8) {
                break;
            }
            const partitionNumber = bytes[2];
            const areaNumber = bytes[3];
            const zoneNumber = (bytes[4] << 8) | bytes[5];
            const state = parseZoneState(bytes[6]);
            return {
                type: 'zoneStatus',
                partitionNumber,
                areaNumber,
                zoneNumber,
                state,
            };
        }
        case constants_1.ConcordCommand.PANEL_EVENT: {
            if (bytes.length < 4) {
                break;
            }
            const subcommandId = bytes[2];
            switch (subcommandId) {
                case constants_1.PanelEventSubcommand.ARMING_LEVEL: {
                    if (bytes.length < 9) {
                        break;
                    }
                    return {
                        type: 'armingLevel',
                        partitionNumber: bytes[3],
                        areaNumber: bytes[4],
                        userNumber: (bytes[5] << 8) | bytes[6],
                        armingLevel: bytes[7],
                    };
                }
                case constants_1.PanelEventSubcommand.ALARM_TROUBLE: {
                    if (bytes.length < 14) {
                        break;
                    }
                    return {
                        type: 'alarmTrouble',
                        partitionNumber: bytes[3],
                        areaNumber: bytes[4],
                        sourceType: bytes[5],
                        sourceNumber: (bytes[6] << 16) | (bytes[7] << 8) | bytes[8],
                        generalType: bytes[9],
                        specificType: bytes[10],
                        eventSpecificData: (bytes[11] << 8) | bytes[12],
                    };
                }
                case constants_1.PanelEventSubcommand.ENTRY_EXIT_DELAY: {
                    if (bytes.length < 9) {
                        break;
                    }
                    const delayFlags = bytes[5];
                    return {
                        type: 'entryExitDelay',
                        partitionNumber: bytes[3],
                        areaNumber: bytes[4],
                        delayFlags,
                        isExitDelay: (delayFlags & 0x40) !== 0,
                        isEndDelay: (delayFlags & 0x80) !== 0,
                        delaySeconds: (bytes[6] << 8) | bytes[7],
                    };
                }
                case constants_1.PanelEventSubcommand.TOUCHPAD_DISPLAY: {
                    if (bytes.length < 7) {
                        break;
                    }
                    const textTokens = bytes.slice(6, bytes.length - 1);
                    return {
                        type: 'touchpadDisplay',
                        partitionNumber: bytes[3],
                        areaNumber: bytes[4],
                        messageType: bytes[5],
                        displayText: (0, constants_1.decodeTextTokens)(textTokens, false),
                    };
                }
                case constants_1.PanelEventSubcommand.FEATURE_STATE: {
                    if (bytes.length < 7) {
                        break;
                    }
                    return {
                        type: 'featureState',
                        partitionNumber: bytes[3],
                        areaNumber: bytes[4],
                        features: parseFeatureState(bytes[5]),
                    };
                }
                default:
                    return {
                        type: 'unknown',
                        commandId,
                        subcommandId,
                        bytes,
                    };
            }
            break;
        }
        default:
            break;
    }
    return {
        type: 'unknown',
        commandId,
        bytes,
    };
}
//# sourceMappingURL=parser.js.map