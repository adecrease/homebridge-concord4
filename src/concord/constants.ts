import type { ResolvedSensorType } from '../settings';

/**
 * Control bytes on the SuperBus 2000 RS-232 interface.
 */
export const CONTROL_ACK = 0x06;
export const CONTROL_LF = 0x0a;
export const CONTROL_NAK = 0x15;

/**
 * Default serial port parameters for GE / Interlogix SuperBus 2000 RS-232 Automation Module.
 */
export const DEFAULT_BAUD_RATE = 9600;
export const DEFAULT_DATA_BITS = 8;
export const DEFAULT_PARITY = 'odd' as const;
export const DEFAULT_STOP_BITS = 1;

/**
 * Primary Command IDs (Byte 1 of decoded frame).
 */
export enum ConcordCommand {
  PANEL_TYPE = 0x01,
  EQUIPMENT_LIST_REQUEST = 0x02, // Also Automation Event Lost when sent by panel
  ZONE_DATA = 0x03,
  PARTITION_DATA = 0x04,
  SUPERBUS_DEV_DATA = 0x05,
  SUPERBUS_CAP_DATA = 0x06,
  OUTPUT_DATA = 0x07,
  EQUIPMENT_LIST_COMPLETE = 0x08,
  USER_DATA = 0x09,
  SCHEDULE_DATA = 0x0a,
  EVENT_DATA = 0x0b,
  LIGHT_ATTACH = 0x0c,
  CLEAR_AUTOMATION_IMAGE = 0x20, // Also Dynamic Data Refresh Request when sent to panel
  ZONE_STATUS = 0x21,
  PANEL_EVENT = 0x22,
  KEYPRESS = 0x40,
}

/**
 * Subcommand IDs when Byte 1 === ConcordCommand.PANEL_EVENT (0x22).
 */
export enum PanelEventSubcommand {
  ARMING_LEVEL = 0x01,
  ALARM_TROUBLE = 0x02,
  ENTRY_EXIT_DELAY = 0x03,
  SIREN_SETUP = 0x04,
  SIREN_SYNC = 0x05,
  SIREN_GO = 0x06,
  TOUCHPAD_DISPLAY = 0x09,
  SIREN_STOP = 0x0b,
  FEATURE_STATE = 0x0c,
  TEMPERATURE = 0x0d,
  TIME_AND_DATE = 0x0e,
  LIGHTS_STATE = 0x0f,
  USER_LIGHTS = 0x10,
  KEYFOB_COMMAND = 0x11,
}

/**
 * Concord Arming Levels (used in 0x04 Byte 4 and 0x22 0x01 Byte 7).
 */
export enum ArmingLevel {
  ZONE_TEST = 0x00,
  OFF = 0x01,
  STAY = 0x02,
  AWAY = 0x03,
  NIGHT = 0x04,
  SILENT = 0x05,
  PHONE_TEST = 0x08,
  SENSOR_TEST = 0x09,
}

/**
 * Zone State Bitmask (used in 0x03 Byte 8 and 0x21 Byte 6).
 */
export enum ZoneStateFlags {
  NORMAL = 0x00,
  TRIPPED = 0x01,
  FAULTED = 0x02,
  ALARM = 0x04,
  TROUBLE = 0x08,
  BYPASSED = 0x10,
}

/**
 * Zone Type Codes (used in 0x03 Byte 7).
 */
export enum ZoneType {
  HARDWIRED = 0x00,
  RF = 0x01,
  RF_TOUCHPAD = 0x02,
}

/**
 * Feature State Bitmask (used in 0x22 0x0C Byte 5).
 */
export enum FeatureStateFlags {
  CHIME = 0x01,
  ENERGY_SAVER = 0x02,
  NO_DELAY = 0x04,
  LATCHKEY = 0x08,
  SILENT_ARMING = 0x10,
  QUICK_ARM = 0x20,
}

/**
 * Alarm / Trouble General Event Types (used in 0x22 0x02 Byte 9).
 */
export enum AlarmGeneralType {
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
  SYSTEM_CONFIG_CHANGE = 18,
}

/**
 * Touchpad Keypress Codes (used in Command 0x40).
 */
export enum KeypressCode {
  DIGIT_0 = 0x00,
  DIGIT_1 = 0x01,
  DIGIT_2 = 0x02,
  DIGIT_3 = 0x03,
  DIGIT_4_NO_DELAY = 0x04,
  DIGIT_5_SILENT = 0x05,
  DIGIT_6 = 0x06,
  DIGIT_7 = 0x07,
  DIGIT_8 = 0x08,
  DIGIT_9 = 0x09,
  STAR = 0x0a,
  POUND = 0x0b,
  POLICE_PANIC = 0x0c,
  AUX_PANIC = 0x0d,
  FIRE_PANIC = 0x0e,
  LIGHTS_ON = 0x10,
  LIGHTS_OFF = 0x11,
  LIGHTS_TOGGLE = 0x12,
  KEYSWITCH_ON = 0x13,
  KEYSWITCH_OFF = 0x14,
  KEYSWITCH_TOGGLE = 0x15,
  FIRE_TP_ACK = 0x1c,
  FIRE_TP_SILENCE = 0x1d,
  FIRE_TP_TEST = 0x1e,
  FIRE_TP_SMOKE_RESET = 0x1f,
  KEYFOB_DISARM = 0x20,
  KEYFOB_ARM = 0x21,
  KEYFOB_LIGHTS = 0x22,
  KEYFOB_STAR = 0x23,
  KEYFOB_ARM_DISARM = 0x24,
  KEYFOB_LIGHTS_STAR = 0x25,
  KEYFOB_LONG_LIGHTS = 0x26,
  KEYFOB_DIRECT_ARM_AWAY = 0x27,
  KEYFOB_DIRECT_ARM_STAY = 0x28,
  KEYFOB_ARM_STAR = 0x29,
  KEYFOB_DISARM_LIGHTS = 0x2a,
  TP_A = 0x2c,
  TP_C = 0x2d,
  TP_E = 0x2e,
  TP_B = 0x30,
  TP_D = 0x33,
  TP_F = 0x36,
}

/**
 * Concord 4 Text Tokens (0x00 - 0xFE).
 * Tokens 0x00 - 0x2E are single characters; 0x2F - 0xD8 are whole words.
 */
export const TEXT_TOKENS: Record<number, string> = {
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
export function decodeTextTokens(tokenBytes: readonly number[], titleCase = true): string {
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

    const tokenText = TEXT_TOKENS[byte];
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
    } else {
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
export function inferSensorType(groupNumber: number, zoneName: string): ResolvedSensorType {
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
export function pinToKeypressCodes(pin: string): number[] {
  const codes: number[] = [];
  for (const ch of pin.trim()) {
    const digit = Number.parseInt(ch, 10);
    if (!Number.isNaN(digit) && digit >= 0 && digit <= 9) {
      codes.push(digit);
    }
  }
  return codes;
}
