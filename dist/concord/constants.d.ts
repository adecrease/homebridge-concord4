import type { ResolvedSensorType } from '../settings';
/**
 * Control bytes on the SuperBus 2000 RS-232 interface.
 */
export declare const CONTROL_ACK = 6;
export declare const CONTROL_LF = 10;
export declare const CONTROL_NAK = 21;
/**
 * Default serial port parameters for GE / Interlogix SuperBus 2000 RS-232 Automation Module.
 */
export declare const DEFAULT_BAUD_RATE = 9600;
export declare const DEFAULT_DATA_BITS = 8;
export declare const DEFAULT_PARITY: "odd";
export declare const DEFAULT_STOP_BITS = 1;
/**
 * Primary Command IDs (Byte 1 of decoded frame).
 */
export declare enum ConcordCommand {
    PANEL_TYPE = 1,
    EQUIPMENT_LIST_REQUEST = 2,// Also Automation Event Lost when sent by panel
    ZONE_DATA = 3,
    PARTITION_DATA = 4,
    SUPERBUS_DEV_DATA = 5,
    SUPERBUS_CAP_DATA = 6,
    OUTPUT_DATA = 7,
    EQUIPMENT_LIST_COMPLETE = 8,
    USER_DATA = 9,
    SCHEDULE_DATA = 10,
    EVENT_DATA = 11,
    LIGHT_ATTACH = 12,
    CLEAR_AUTOMATION_IMAGE = 32,// Also Dynamic Data Refresh Request when sent to panel
    ZONE_STATUS = 33,
    PANEL_EVENT = 34,
    KEYPRESS = 64
}
/**
 * Subcommand IDs when Byte 1 === ConcordCommand.PANEL_EVENT (0x22).
 */
export declare enum PanelEventSubcommand {
    ARMING_LEVEL = 1,
    ALARM_TROUBLE = 2,
    ENTRY_EXIT_DELAY = 3,
    SIREN_SETUP = 4,
    SIREN_SYNC = 5,
    SIREN_GO = 6,
    TOUCHPAD_DISPLAY = 9,
    SIREN_STOP = 11,
    FEATURE_STATE = 12,
    TEMPERATURE = 13,
    TIME_AND_DATE = 14,
    LIGHTS_STATE = 15,
    USER_LIGHTS = 16,
    KEYFOB_COMMAND = 17
}
/**
 * Concord Arming Levels (used in 0x04 Byte 4 and 0x22 0x01 Byte 7).
 */
export declare enum ArmingLevel {
    ZONE_TEST = 0,
    OFF = 1,
    STAY = 2,
    AWAY = 3,
    NIGHT = 4,
    SILENT = 5,
    PHONE_TEST = 8,
    SENSOR_TEST = 9
}
/**
 * Zone State Bitmask (used in 0x03 Byte 8 and 0x21 Byte 6).
 */
export declare enum ZoneStateFlags {
    NORMAL = 0,
    TRIPPED = 1,
    FAULTED = 2,
    ALARM = 4,
    TROUBLE = 8,
    BYPASSED = 16
}
/**
 * Zone Type Codes (used in 0x03 Byte 7).
 */
export declare enum ZoneType {
    HARDWIRED = 0,
    RF = 1,
    RF_TOUCHPAD = 2
}
/**
 * Feature State Bitmask (used in 0x22 0x0C Byte 5).
 */
export declare enum FeatureStateFlags {
    CHIME = 1,
    ENERGY_SAVER = 2,
    NO_DELAY = 4,
    LATCHKEY = 8,
    SILENT_ARMING = 16,
    QUICK_ARM = 32
}
/**
 * Alarm / Trouble General Event Types (used in 0x22 0x02 Byte 9).
 */
export declare enum AlarmGeneralType {
    ALARM = 1,
    ALARM_CANCEL = 2,
    ALARM_RESTORAL = 3,
    FIRE_TROUBLE = 4,
    FIRE_TROUBLE_RESTORAL = 5,
    NON_FIRE_TROUBLE = 6,
    NON_FIRE_TROUBLE_RESTORAL = 7,
    BYPASS = 8,
    UNBYPASS = 9,
    OPENING = 10,
    CLOSING = 11,
    PARTITION_CONFIG_CHANGE = 12,
    PARTITION_EVENT = 13,
    PARTITION_TEST = 14,
    SYSTEM_EVENT = 15,
    SYSTEM_NON_FIRE_TROUBLE = 16,
    SYSTEM_NON_FIRE_TROUBLE_RESTORAL = 17,
    SYSTEM_CONFIG_CHANGE = 18
}
/**
 * Touchpad Keypress Codes (used in Command 0x40).
 */
export declare enum KeypressCode {
    DIGIT_0 = 0,
    DIGIT_1 = 1,
    DIGIT_2 = 2,
    DIGIT_3 = 3,
    DIGIT_4_NO_DELAY = 4,
    DIGIT_5_SILENT = 5,
    DIGIT_6 = 6,
    DIGIT_7 = 7,
    DIGIT_8 = 8,
    DIGIT_9 = 9,
    STAR = 10,
    POUND = 11,
    POLICE_PANIC = 12,
    AUX_PANIC = 13,
    FIRE_PANIC = 14,
    LIGHTS_ON = 16,
    LIGHTS_OFF = 17,
    LIGHTS_TOGGLE = 18,
    KEYSWITCH_ON = 19,
    KEYSWITCH_OFF = 20,
    KEYSWITCH_TOGGLE = 21,
    FIRE_TP_ACK = 28,
    FIRE_TP_SILENCE = 29,
    FIRE_TP_TEST = 30,
    FIRE_TP_SMOKE_RESET = 31,
    KEYFOB_DISARM = 32,
    KEYFOB_ARM = 33,
    KEYFOB_LIGHTS = 34,
    KEYFOB_STAR = 35,
    KEYFOB_ARM_DISARM = 36,
    KEYFOB_LIGHTS_STAR = 37,
    KEYFOB_LONG_LIGHTS = 38,
    KEYFOB_DIRECT_ARM_AWAY = 39,
    KEYFOB_DIRECT_ARM_STAY = 40,
    KEYFOB_ARM_STAR = 41,
    KEYFOB_DISARM_LIGHTS = 42,
    TP_A = 44,
    TP_C = 45,
    TP_E = 46,
    TP_B = 48,
    TP_D = 51,
    TP_F = 54
}
/**
 * Concord 4 Text Tokens (0x00 - 0xFE).
 * Tokens 0x00 - 0x2E are single characters; 0x2F - 0xD8 are whole words.
 */
export declare const TEXT_TOKENS: Record<number, string>;
/**
 * Decodes an array of Concord token bytes into a human-readable Title Case or UPPERCASE string.
 */
export declare function decodeTextTokens(tokenBytes: readonly number[], titleCase?: boolean): string;
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
export declare function inferSensorType(groupNumber: number, zoneName: string): ResolvedSensorType;
/**
 * Converts a PIN string (e.g. "1234") into an array of KeypressCode digits.
 */
export declare function pinToKeypressCodes(pin: string): number[];
