"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEXT_TOKENS = exports.KeypressCode = exports.AlarmGeneralType = exports.FeatureStateFlags = exports.ZoneType = exports.ZoneStateFlags = exports.ArmingLevel = exports.PanelEventSubcommand = exports.ConcordCommand = exports.DEFAULT_STOP_BITS = exports.DEFAULT_PARITY = exports.DEFAULT_DATA_BITS = exports.DEFAULT_BAUD_RATE = exports.CONTROL_NAK = exports.CONTROL_LF = exports.CONTROL_ACK = void 0;
exports.decodeTextTokens = decodeTextTokens;
exports.inferSensorType = inferSensorType;
exports.pinToKeypressCodes = pinToKeypressCodes;
/**
 * Control bytes on the SuperBus 2000 RS-232 interface.
 */
exports.CONTROL_ACK = 0x06;
exports.CONTROL_LF = 0x0a;
exports.CONTROL_NAK = 0x15;
/**
 * Default serial port parameters for GE / Interlogix SuperBus 2000 RS-232 Automation Module.
 */
exports.DEFAULT_BAUD_RATE = 9600;
exports.DEFAULT_DATA_BITS = 8;
exports.DEFAULT_PARITY = 'odd';
exports.DEFAULT_STOP_BITS = 1;
/**
 * Primary Command IDs (Byte 1 of decoded frame).
 */
var ConcordCommand;
(function (ConcordCommand) {
    ConcordCommand[ConcordCommand["PANEL_TYPE"] = 1] = "PANEL_TYPE";
    ConcordCommand[ConcordCommand["EQUIPMENT_LIST_REQUEST"] = 2] = "EQUIPMENT_LIST_REQUEST";
    ConcordCommand[ConcordCommand["ZONE_DATA"] = 3] = "ZONE_DATA";
    ConcordCommand[ConcordCommand["PARTITION_DATA"] = 4] = "PARTITION_DATA";
    ConcordCommand[ConcordCommand["SUPERBUS_DEV_DATA"] = 5] = "SUPERBUS_DEV_DATA";
    ConcordCommand[ConcordCommand["SUPERBUS_CAP_DATA"] = 6] = "SUPERBUS_CAP_DATA";
    ConcordCommand[ConcordCommand["OUTPUT_DATA"] = 7] = "OUTPUT_DATA";
    ConcordCommand[ConcordCommand["EQUIPMENT_LIST_COMPLETE"] = 8] = "EQUIPMENT_LIST_COMPLETE";
    ConcordCommand[ConcordCommand["USER_DATA"] = 9] = "USER_DATA";
    ConcordCommand[ConcordCommand["SCHEDULE_DATA"] = 10] = "SCHEDULE_DATA";
    ConcordCommand[ConcordCommand["EVENT_DATA"] = 11] = "EVENT_DATA";
    ConcordCommand[ConcordCommand["LIGHT_ATTACH"] = 12] = "LIGHT_ATTACH";
    ConcordCommand[ConcordCommand["CLEAR_AUTOMATION_IMAGE"] = 32] = "CLEAR_AUTOMATION_IMAGE";
    ConcordCommand[ConcordCommand["ZONE_STATUS"] = 33] = "ZONE_STATUS";
    ConcordCommand[ConcordCommand["PANEL_EVENT"] = 34] = "PANEL_EVENT";
    ConcordCommand[ConcordCommand["KEYPRESS"] = 64] = "KEYPRESS";
})(ConcordCommand || (exports.ConcordCommand = ConcordCommand = {}));
/**
 * Subcommand IDs when Byte 1 === ConcordCommand.PANEL_EVENT (0x22).
 */
var PanelEventSubcommand;
(function (PanelEventSubcommand) {
    PanelEventSubcommand[PanelEventSubcommand["ARMING_LEVEL"] = 1] = "ARMING_LEVEL";
    PanelEventSubcommand[PanelEventSubcommand["ALARM_TROUBLE"] = 2] = "ALARM_TROUBLE";
    PanelEventSubcommand[PanelEventSubcommand["ENTRY_EXIT_DELAY"] = 3] = "ENTRY_EXIT_DELAY";
    PanelEventSubcommand[PanelEventSubcommand["SIREN_SETUP"] = 4] = "SIREN_SETUP";
    PanelEventSubcommand[PanelEventSubcommand["SIREN_SYNC"] = 5] = "SIREN_SYNC";
    PanelEventSubcommand[PanelEventSubcommand["SIREN_GO"] = 6] = "SIREN_GO";
    PanelEventSubcommand[PanelEventSubcommand["TOUCHPAD_DISPLAY"] = 9] = "TOUCHPAD_DISPLAY";
    PanelEventSubcommand[PanelEventSubcommand["SIREN_STOP"] = 11] = "SIREN_STOP";
    PanelEventSubcommand[PanelEventSubcommand["FEATURE_STATE"] = 12] = "FEATURE_STATE";
    PanelEventSubcommand[PanelEventSubcommand["TEMPERATURE"] = 13] = "TEMPERATURE";
    PanelEventSubcommand[PanelEventSubcommand["TIME_AND_DATE"] = 14] = "TIME_AND_DATE";
    PanelEventSubcommand[PanelEventSubcommand["LIGHTS_STATE"] = 15] = "LIGHTS_STATE";
    PanelEventSubcommand[PanelEventSubcommand["USER_LIGHTS"] = 16] = "USER_LIGHTS";
    PanelEventSubcommand[PanelEventSubcommand["KEYFOB_COMMAND"] = 17] = "KEYFOB_COMMAND";
})(PanelEventSubcommand || (exports.PanelEventSubcommand = PanelEventSubcommand = {}));
/**
 * Concord Arming Levels (used in 0x04 Byte 4 and 0x22 0x01 Byte 7).
 */
var ArmingLevel;
(function (ArmingLevel) {
    ArmingLevel[ArmingLevel["ZONE_TEST"] = 0] = "ZONE_TEST";
    ArmingLevel[ArmingLevel["OFF"] = 1] = "OFF";
    ArmingLevel[ArmingLevel["STAY"] = 2] = "STAY";
    ArmingLevel[ArmingLevel["AWAY"] = 3] = "AWAY";
    ArmingLevel[ArmingLevel["NIGHT"] = 4] = "NIGHT";
    ArmingLevel[ArmingLevel["SILENT"] = 5] = "SILENT";
    ArmingLevel[ArmingLevel["PHONE_TEST"] = 8] = "PHONE_TEST";
    ArmingLevel[ArmingLevel["SENSOR_TEST"] = 9] = "SENSOR_TEST";
})(ArmingLevel || (exports.ArmingLevel = ArmingLevel = {}));
/**
 * Zone State Bitmask (used in 0x03 Byte 8 and 0x21 Byte 6).
 */
var ZoneStateFlags;
(function (ZoneStateFlags) {
    ZoneStateFlags[ZoneStateFlags["NORMAL"] = 0] = "NORMAL";
    ZoneStateFlags[ZoneStateFlags["TRIPPED"] = 1] = "TRIPPED";
    ZoneStateFlags[ZoneStateFlags["FAULTED"] = 2] = "FAULTED";
    ZoneStateFlags[ZoneStateFlags["ALARM"] = 4] = "ALARM";
    ZoneStateFlags[ZoneStateFlags["TROUBLE"] = 8] = "TROUBLE";
    ZoneStateFlags[ZoneStateFlags["BYPASSED"] = 16] = "BYPASSED";
})(ZoneStateFlags || (exports.ZoneStateFlags = ZoneStateFlags = {}));
/**
 * Zone Type Codes (used in 0x03 Byte 7).
 */
var ZoneType;
(function (ZoneType) {
    ZoneType[ZoneType["HARDWIRED"] = 0] = "HARDWIRED";
    ZoneType[ZoneType["RF"] = 1] = "RF";
    ZoneType[ZoneType["RF_TOUCHPAD"] = 2] = "RF_TOUCHPAD";
})(ZoneType || (exports.ZoneType = ZoneType = {}));
/**
 * Feature State Bitmask (used in 0x22 0x0C Byte 5).
 */
var FeatureStateFlags;
(function (FeatureStateFlags) {
    FeatureStateFlags[FeatureStateFlags["CHIME"] = 1] = "CHIME";
    FeatureStateFlags[FeatureStateFlags["ENERGY_SAVER"] = 2] = "ENERGY_SAVER";
    FeatureStateFlags[FeatureStateFlags["NO_DELAY"] = 4] = "NO_DELAY";
    FeatureStateFlags[FeatureStateFlags["LATCHKEY"] = 8] = "LATCHKEY";
    FeatureStateFlags[FeatureStateFlags["SILENT_ARMING"] = 16] = "SILENT_ARMING";
    FeatureStateFlags[FeatureStateFlags["QUICK_ARM"] = 32] = "QUICK_ARM";
})(FeatureStateFlags || (exports.FeatureStateFlags = FeatureStateFlags = {}));
/**
 * Alarm / Trouble General Event Types (used in 0x22 0x02 Byte 9).
 */
var AlarmGeneralType;
(function (AlarmGeneralType) {
    AlarmGeneralType[AlarmGeneralType["ALARM"] = 1] = "ALARM";
    AlarmGeneralType[AlarmGeneralType["ALARM_CANCEL"] = 2] = "ALARM_CANCEL";
    AlarmGeneralType[AlarmGeneralType["ALARM_RESTORAL"] = 3] = "ALARM_RESTORAL";
    AlarmGeneralType[AlarmGeneralType["FIRE_TROUBLE"] = 4] = "FIRE_TROUBLE";
    AlarmGeneralType[AlarmGeneralType["FIRE_TROUBLE_RESTORAL"] = 5] = "FIRE_TROUBLE_RESTORAL";
    AlarmGeneralType[AlarmGeneralType["NON_FIRE_TROUBLE"] = 6] = "NON_FIRE_TROUBLE";
    AlarmGeneralType[AlarmGeneralType["NON_FIRE_TROUBLE_RESTORAL"] = 7] = "NON_FIRE_TROUBLE_RESTORAL";
    AlarmGeneralType[AlarmGeneralType["BYPASS"] = 8] = "BYPASS";
    AlarmGeneralType[AlarmGeneralType["UNBYPASS"] = 9] = "UNBYPASS";
    AlarmGeneralType[AlarmGeneralType["OPENING"] = 10] = "OPENING";
    AlarmGeneralType[AlarmGeneralType["CLOSING"] = 11] = "CLOSING";
    AlarmGeneralType[AlarmGeneralType["PARTITION_CONFIG_CHANGE"] = 12] = "PARTITION_CONFIG_CHANGE";
    AlarmGeneralType[AlarmGeneralType["PARTITION_EVENT"] = 13] = "PARTITION_EVENT";
    AlarmGeneralType[AlarmGeneralType["PARTITION_TEST"] = 14] = "PARTITION_TEST";
    AlarmGeneralType[AlarmGeneralType["SYSTEM_EVENT"] = 15] = "SYSTEM_EVENT";
    AlarmGeneralType[AlarmGeneralType["SYSTEM_NON_FIRE_TROUBLE"] = 16] = "SYSTEM_NON_FIRE_TROUBLE";
    AlarmGeneralType[AlarmGeneralType["SYSTEM_NON_FIRE_TROUBLE_RESTORAL"] = 17] = "SYSTEM_NON_FIRE_TROUBLE_RESTORAL";
    AlarmGeneralType[AlarmGeneralType["SYSTEM_CONFIG_CHANGE"] = 18] = "SYSTEM_CONFIG_CHANGE";
})(AlarmGeneralType || (exports.AlarmGeneralType = AlarmGeneralType = {}));
/**
 * Touchpad Keypress Codes (used in Command 0x40).
 */
var KeypressCode;
(function (KeypressCode) {
    KeypressCode[KeypressCode["DIGIT_0"] = 0] = "DIGIT_0";
    KeypressCode[KeypressCode["DIGIT_1"] = 1] = "DIGIT_1";
    KeypressCode[KeypressCode["DIGIT_2"] = 2] = "DIGIT_2";
    KeypressCode[KeypressCode["DIGIT_3"] = 3] = "DIGIT_3";
    KeypressCode[KeypressCode["DIGIT_4_NO_DELAY"] = 4] = "DIGIT_4_NO_DELAY";
    KeypressCode[KeypressCode["DIGIT_5_SILENT"] = 5] = "DIGIT_5_SILENT";
    KeypressCode[KeypressCode["DIGIT_6"] = 6] = "DIGIT_6";
    KeypressCode[KeypressCode["DIGIT_7"] = 7] = "DIGIT_7";
    KeypressCode[KeypressCode["DIGIT_8"] = 8] = "DIGIT_8";
    KeypressCode[KeypressCode["DIGIT_9"] = 9] = "DIGIT_9";
    KeypressCode[KeypressCode["STAR"] = 10] = "STAR";
    KeypressCode[KeypressCode["POUND"] = 11] = "POUND";
    KeypressCode[KeypressCode["POLICE_PANIC"] = 12] = "POLICE_PANIC";
    KeypressCode[KeypressCode["AUX_PANIC"] = 13] = "AUX_PANIC";
    KeypressCode[KeypressCode["FIRE_PANIC"] = 14] = "FIRE_PANIC";
    KeypressCode[KeypressCode["LIGHTS_ON"] = 16] = "LIGHTS_ON";
    KeypressCode[KeypressCode["LIGHTS_OFF"] = 17] = "LIGHTS_OFF";
    KeypressCode[KeypressCode["LIGHTS_TOGGLE"] = 18] = "LIGHTS_TOGGLE";
    KeypressCode[KeypressCode["KEYSWITCH_ON"] = 19] = "KEYSWITCH_ON";
    KeypressCode[KeypressCode["KEYSWITCH_OFF"] = 20] = "KEYSWITCH_OFF";
    KeypressCode[KeypressCode["KEYSWITCH_TOGGLE"] = 21] = "KEYSWITCH_TOGGLE";
    KeypressCode[KeypressCode["FIRE_TP_ACK"] = 28] = "FIRE_TP_ACK";
    KeypressCode[KeypressCode["FIRE_TP_SILENCE"] = 29] = "FIRE_TP_SILENCE";
    KeypressCode[KeypressCode["FIRE_TP_TEST"] = 30] = "FIRE_TP_TEST";
    KeypressCode[KeypressCode["FIRE_TP_SMOKE_RESET"] = 31] = "FIRE_TP_SMOKE_RESET";
    KeypressCode[KeypressCode["KEYFOB_DISARM"] = 32] = "KEYFOB_DISARM";
    KeypressCode[KeypressCode["KEYFOB_ARM"] = 33] = "KEYFOB_ARM";
    KeypressCode[KeypressCode["KEYFOB_LIGHTS"] = 34] = "KEYFOB_LIGHTS";
    KeypressCode[KeypressCode["KEYFOB_STAR"] = 35] = "KEYFOB_STAR";
    KeypressCode[KeypressCode["KEYFOB_ARM_DISARM"] = 36] = "KEYFOB_ARM_DISARM";
    KeypressCode[KeypressCode["KEYFOB_LIGHTS_STAR"] = 37] = "KEYFOB_LIGHTS_STAR";
    KeypressCode[KeypressCode["KEYFOB_LONG_LIGHTS"] = 38] = "KEYFOB_LONG_LIGHTS";
    KeypressCode[KeypressCode["KEYFOB_DIRECT_ARM_AWAY"] = 39] = "KEYFOB_DIRECT_ARM_AWAY";
    KeypressCode[KeypressCode["KEYFOB_DIRECT_ARM_STAY"] = 40] = "KEYFOB_DIRECT_ARM_STAY";
    KeypressCode[KeypressCode["KEYFOB_ARM_STAR"] = 41] = "KEYFOB_ARM_STAR";
    KeypressCode[KeypressCode["KEYFOB_DISARM_LIGHTS"] = 42] = "KEYFOB_DISARM_LIGHTS";
    KeypressCode[KeypressCode["TP_A"] = 44] = "TP_A";
    KeypressCode[KeypressCode["TP_C"] = 45] = "TP_C";
    KeypressCode[KeypressCode["TP_E"] = 46] = "TP_E";
    KeypressCode[KeypressCode["TP_B"] = 48] = "TP_B";
    KeypressCode[KeypressCode["TP_D"] = 51] = "TP_D";
    KeypressCode[KeypressCode["TP_F"] = 54] = "TP_F";
})(KeypressCode || (exports.KeypressCode = KeypressCode = {}));
/**
 * Concord 4 Text Tokens (0x00 - 0xFE).
 * Tokens 0x00 - 0x2E are single characters; 0x2F - 0xD8 are whole words.
 */
exports.TEXT_TOKENS = {
    0x00: '0',
    0x01: '1',
    0x02: '2',
    0x03: '3',
    0x04: '4',
    0x05: '5',
    0x06: '6',
    0x07: '7',
    0x08: '8',
    0x09: '9',
    0x0c: '#',
    0x0d: ':',
    0x0e: '/',
    0x0f: '?',
    0x10: '.',
    0x11: 'A',
    0x12: 'B',
    0x13: 'C',
    0x14: 'D',
    0x15: 'E',
    0x16: 'F',
    0x17: 'G',
    0x18: 'H',
    0x19: 'I',
    0x1a: 'J',
    0x1b: 'K',
    0x1c: 'L',
    0x1d: 'M',
    0x1e: 'N',
    0x1f: 'O',
    0x20: 'P',
    0x21: 'Q',
    0x22: 'R',
    0x23: 'S',
    0x24: 'T',
    0x25: 'U',
    0x26: 'V',
    0x27: 'W',
    0x28: 'X',
    0x29: 'Y',
    0x2a: 'Z',
    0x2b: ' ',
    0x2c: "'",
    0x2d: '-',
    0x2e: '*',
    0x2f: 'AC POWER',
    0x31: 'ACCESS',
    0x32: 'ACCOUNT',
    0x33: 'ALARM',
    0x34: 'ALL',
    0x35: 'ARM',
    0x36: 'ARMING',
    0x37: 'AREA',
    0x38: 'ATTIC',
    0x39: 'AUTO',
    0x3a: 'AUXILIARY',
    0x3b: 'AWAY',
    0x3c: 'BACK',
    0x3d: 'BATTERY',
    0x3e: 'BEDROOM',
    0x3f: 'BEEPS',
    0x40: 'BOTTOM',
    0x41: 'BREEZEWAY',
    0x42: 'BASEMENT',
    0x43: 'BATHROOM',
    0x44: 'BUS',
    0x45: 'BYPASS',
    0x46: 'BYPASSED',
    0x47: 'CABINET',
    0x48: 'CANCELED',
    0x49: 'CARPET',
    0x4a: 'CHIME',
    0x4b: 'CLOSET',
    0x4c: 'CLOSING',
    0x4d: 'CODE',
    0x4e: 'CONTROL',
    0x4f: 'CPU',
    0x50: 'DEGREES',
    0x51: 'DEN',
    0x52: 'DESK',
    0x53: 'DELAY',
    0x54: 'DELETE',
    0x55: 'DINING',
    0x56: 'DIRECT',
    0x57: 'DOOR',
    0x58: 'DOWN',
    0x59: 'DOWNLOAD',
    0x5a: 'DOWNSTAIRS',
    0x5b: 'DRAWER',
    0x5c: 'DISPLAY',
    0x5d: 'DURESS',
    0x5e: 'EAST',
    0x5f: 'ENERGY SAVER',
    0x60: 'ENTER',
    0x61: 'ENTRY',
    0x62: 'ERROR',
    0x63: 'EXIT',
    0x64: 'FAIL',
    0x65: 'FAILURE',
    0x66: 'FAMILY',
    0x67: 'FEATURES',
    0x68: 'FIRE',
    0x69: 'FIRST',
    0x6a: 'FLOOR',
    0x6b: 'FORCE',
    0x6c: 'FORMAT',
    0x6d: 'FREEZE',
    0x6e: 'FRONT',
    0x6f: 'FURNACE',
    0x70: 'GARAGE',
    0x71: 'GALLERY',
    0x72: 'GOODBYE',
    0x73: 'GROUP',
    0x74: 'HALL',
    0x75: 'HEAT',
    0x76: 'HELLO',
    0x77: 'HELP',
    0x78: 'HIGH',
    0x79: 'HOURLY',
    0x7a: 'HOUSE',
    0x7b: 'IMMEDIATE',
    0x7c: 'IN SERVICE',
    0x7d: 'INTERIOR',
    0x7e: 'INTRUSION',
    0x7f: 'INVALID',
    0x80: 'IS',
    0x81: 'KEY',
    0x82: 'KITCHEN',
    0x83: 'LAUNDRY',
    0x84: 'LEARN',
    0x85: 'LEFT',
    0x86: 'LIBRARY',
    0x87: 'LEVEL',
    0x88: 'LIGHT',
    0x89: 'LIGHTS',
    0x8a: 'LIVING',
    0x8b: 'LOW',
    0x8c: 'MAIN',
    0x8d: 'MASTER',
    0x8e: 'MEDICAL',
    0x8f: 'MEMORY',
    0x90: 'MIN',
    0x91: 'MODE',
    0x92: 'MOTION',
    0x93: 'NIGHT',
    0x94: 'NORTH',
    0x95: 'NOT',
    0x96: 'NUMBER',
    0x97: 'OFF',
    0x98: 'OFFICE',
    0x99: 'OK',
    0x9a: 'ON',
    0x9b: 'OPEN',
    0x9c: 'OPENING',
    0x9d: 'PANIC',
    0x9e: 'PARTITION',
    0x9f: 'PATIO',
    0xa0: 'PHONE',
    0xa1: 'POLICE',
    0xa2: 'POOL',
    0xa3: 'PORCH',
    0xa4: 'PRESS',
    0xa5: 'QUIET',
    0xa6: 'QUICK',
    0xa7: 'RECEIVER',
    0xa8: 'REAR',
    0xa9: 'REPORT',
    0xaa: 'REMOTE',
    0xab: 'RESTORE',
    0xac: 'RIGHT',
    0xad: 'ROOM',
    0xae: 'SCHEDULE',
    0xaf: 'SCRIPT',
    0xb0: 'SEC',
    0xb1: 'SECOND',
    0xb2: 'SET',
    0xb3: 'SENSOR',
    0xb4: 'SHOCK',
    0xb5: 'SIDE',
    0xb6: 'SIREN',
    0xb7: 'SLIDING',
    0xb8: 'SMOKE',
    0xb9: 'Sn',
    0xba: 'SOUND',
    0xbb: 'SOUTH',
    0xbc: 'SPECIAL',
    0xbd: 'STAIRS',
    0xbe: 'START',
    0xbf: 'STATUS',
    0xc0: 'STAY',
    0xc1: 'STOP',
    0xc2: 'SUPERVISORY',
    0xc3: 'SYSTEM',
    0xc4: 'TAMPER',
    0xc5: 'TEMPERATURE',
    0xc6: 'TEMPORARY',
    0xc7: 'TEST',
    0xc8: 'TIME',
    0xc9: 'TIMEOUT',
    0xca: 'TOUCHPAD',
    0xcb: 'TRIP',
    0xcc: 'TROUBLE',
    0xcd: 'UNBYPASS',
    0xce: 'UNIT',
    0xcf: 'UP',
    0xd0: 'VERIFY',
    0xd1: 'VIOLATION',
    0xd2: 'WARNING',
    0xd3: 'WEST',
    0xd4: 'WINDOW',
    0xd5: 'MENU',
    0xd6: 'RETURN',
    0xd7: 'POUND',
    0xd8: 'HOME',
    0xf9: ' ',
    0xfa: ' ',
    0xfb: ' ',
};
/**
 * Decodes an array of Concord token bytes into a human-readable Title Case or UPPERCASE string.
 */
function decodeTextTokens(tokenBytes, titleCase = true) {
    if (!tokenBytes || tokenBytes.length === 0) {
        return '';
    }
    let result = '';
    let previousWasSingleChar = false;
    for (const byte of tokenBytes) {
        if (byte === 0xfd) {
            // Backspace token
            result = result.slice(0, -1);
            continue;
        }
        if (byte === 0xfe) {
            // Blink next token modifier - ignore for text decoding
            continue;
        }
        const tokenText = exports.TEXT_TOKENS[byte];
        if (tokenText === undefined) {
            continue;
        }
        const isSingleChar = byte <= 0x2e;
        if (isSingleChar) {
            if (!previousWasSingleChar && result.length > 0 && !result.endsWith(' ') && tokenText !== ' ') {
                result += ' ';
            }
            result += tokenText;
            previousWasSingleChar = tokenText !== ' ';
        }
        else {
            // Word token (0x2F - 0xD8) or control whitespace (0xF9 - 0xFB)
            if (result.length > 0 && !result.endsWith(' ') && tokenText !== ' ') {
                result += ' ';
            }
            result += tokenText;
            previousWasSingleChar = false;
        }
    }
    const normalized = result.replace(/\s+/g, ' ').trim();
    if (!titleCase || normalized.length === 0) {
        return normalized;
    }
    return normalized
        .split(' ')
        .map((word) => {
        if (word === 'CO' || word === 'AC' || word === 'CPU' || word === 'RF') {
            return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
        .join(' ');
}
/**
 * Infers the most appropriate HomeKit sensor type from the Concord 4 Zone Group and decoded Zone Name.
 *
 * Concord 4 Zone Groups reference:
 * - 10, 11, 12, 13, 19, 25, 35: Doors, Windows, Glassbreak, Local perimeter -> 'contact'
 * - 14, 15, 16, 17, 18, 20: Interior Follower / Interior Motion -> 'motion'
 * - 26: 24-Hr Fire / Smoke / Heat -> 'smoke'
 * - 34: 24-Hr Carbon Monoxide (CO) -> 'co'
 * - 38: 24-Hr Water / Flood -> 'leak'
 */
function inferSensorType(groupNumber, zoneName) {
    // 1. High-confidence life-safety & environmental groups first
    if (groupNumber === 26) {
        return 'smoke';
    }
    if (groupNumber === 34) {
        return 'co';
    }
    if (groupNumber === 38) {
        return 'leak';
    }
    // 2. Check explicit keywords in zone name (handles custom installers who put sensors in non-standard groups)
    const upperName = zoneName.toUpperCase();
    if (/\b(SMOKE|FIRE|HEAT)\b/.test(upperName)) {
        return 'smoke';
    }
    if (/\b(CO|CARBON)\b/.test(upperName)) {
        return 'co';
    }
    if (/\b(WATER|LEAK|FLOOD|SUMP|MOISTURE)\b/.test(upperName)) {
        return 'leak';
    }
    if (/\b(MOTION|PIR)\b/.test(upperName)) {
        return 'motion';
    }
    if (/\b(DOOR|WINDOW|GARAGE|SLIDING|PATIO|ENTRY|GATE)\b/.test(upperName)) {
        return 'contact';
    }
    // 3. Fall back to Concord 4 interior motion groups vs perimeter contact groups
    if (groupNumber >= 14 && groupNumber <= 18) {
        return 'motion';
    }
    if (groupNumber === 20) {
        return 'motion';
    }
    return 'contact';
}
/**
 * Converts a PIN string (e.g. "1234") into an array of KeypressCode digits.
 */
function pinToKeypressCodes(pin) {
    const codes = [];
    for (const ch of pin.trim()) {
        const digit = Number.parseInt(ch, 10);
        if (!Number.isNaN(digit) && digit >= 0 && digit <= 9) {
            codes.push(digit);
        }
    }
    return codes;
}
//# sourceMappingURL=constants.js.map