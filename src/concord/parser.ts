import {
  AlarmGeneralType,
  ArmingLevel,
  ConcordCommand,
  FeatureStateFlags,
  PanelEventSubcommand,
  ZoneStateFlags,
  ZoneType,
  decodeTextTokens,
} from './constants';

export interface ZoneStateBreakdown {
  raw: number;
  tripped: boolean;
  faulted: boolean;
  alarm: boolean;
  trouble: boolean;
  bypassed: boolean;
}

export interface FeatureStateBreakdown {
  raw: number;
  chime: boolean;
  energySaver: boolean;
  noDelay: boolean;
  latchkey: boolean;
  silentArming: boolean;
  quickArm: boolean;
}

export type ConcordParsedMessage =
  | {
      type: 'automationEventLost';
    }
  | {
      type: 'equipmentListComplete';
    }
  | {
      type: 'clearAutomationImage';
    }
  | {
      type: 'zoneData';
      partitionNumber: number;
      areaNumber: number;
      groupNumber: number;
      zoneNumber: number;
      zoneType: ZoneType;
      state: ZoneStateBreakdown;
      zoneName: string;
    }
  | {
      type: 'partitionData';
      partitionNumber: number;
      areaNumber: number;
      armingLevel: ArmingLevel;
      partitionName: string;
    }
  | {
      type: 'zoneStatus';
      partitionNumber: number;
      areaNumber: number;
      zoneNumber: number;
      state: ZoneStateBreakdown;
    }
  | {
      type: 'armingLevel';
      partitionNumber: number;
      areaNumber: number;
      userNumber: number;
      armingLevel: ArmingLevel;
    }
  | {
      type: 'alarmTrouble';
      partitionNumber: number;
      areaNumber: number;
      sourceType: number;
      sourceNumber: number;
      generalType: AlarmGeneralType;
      specificType: number;
      eventSpecificData: number;
    }
  | {
      type: 'entryExitDelay';
      partitionNumber: number;
      areaNumber: number;
      delayFlags: number;
      isExitDelay: boolean;
      isEndDelay: boolean;
      delaySeconds: number;
    }
  | {
      type: 'touchpadDisplay';
      partitionNumber: number;
      areaNumber: number;
      messageType: number;
      displayText: string;
    }
  | {
      type: 'featureState';
      partitionNumber: number;
      areaNumber: number;
      features: FeatureStateBreakdown;
    }
  | {
      type: 'unknown';
      commandId: number;
      subcommandId?: number;
      bytes: readonly number[];
    };

export function parseZoneState(mask: number): ZoneStateBreakdown {
  return {
    raw: mask,
    tripped: (mask & ZoneStateFlags.TRIPPED) !== 0,
    faulted: (mask & ZoneStateFlags.FAULTED) !== 0,
    alarm: (mask & ZoneStateFlags.ALARM) !== 0,
    trouble: (mask & ZoneStateFlags.TROUBLE) !== 0,
    bypassed: (mask & ZoneStateFlags.BYPASSED) !== 0,
  };
}

export function parseFeatureState(mask: number): FeatureStateBreakdown {
  return {
    raw: mask,
    chime: (mask & FeatureStateFlags.CHIME) !== 0,
    energySaver: (mask & FeatureStateFlags.ENERGY_SAVER) !== 0,
    noDelay: (mask & FeatureStateFlags.NO_DELAY) !== 0,
    latchkey: (mask & FeatureStateFlags.LATCHKEY) !== 0,
    silentArming: (mask & FeatureStateFlags.SILENT_ARMING) !== 0,
    quickArm: (mask & FeatureStateFlags.QUICK_ARM) !== 0,
  };
}

/**
 * Parses a validated binary Concord frame `[LI, CMD, ...DATA, CS]` into a typed message object.
 */
export function parseConcordFrame(bytes: readonly number[]): ConcordParsedMessage {
  if (bytes.length < 3) {
    return {
      type: 'unknown',
      commandId: bytes[1] ?? -1,
      bytes,
    };
  }

  const commandId = bytes[1];

  switch (commandId) {
    case ConcordCommand.EQUIPMENT_LIST_REQUEST:
      return { type: 'automationEventLost' };

    case ConcordCommand.EQUIPMENT_LIST_COMPLETE:
      return { type: 'equipmentListComplete' };

    case ConcordCommand.CLEAR_AUTOMATION_IMAGE:
      return { type: 'clearAutomationImage' };

    case ConcordCommand.ZONE_DATA: {
      if (bytes.length < 10) {
        break;
      }
      const partitionNumber = bytes[2];
      const areaNumber = bytes[3];
      const groupNumber = bytes[4];
      const zoneNumber = (bytes[5] << 8) | bytes[6];
      const zoneType = bytes[7] as ZoneType;
      const state = parseZoneState(bytes[8]);
      const textTokens = bytes.slice(9, bytes.length - 1);
      const decodedName = decodeTextTokens(textTokens, true);

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

    case ConcordCommand.PARTITION_DATA: {
      if (bytes.length < 6) {
        break;
      }
      const partitionNumber = bytes[2];
      const areaNumber = bytes[3];
      const armingLevel = bytes[4] as ArmingLevel;
      const textTokens = bytes.slice(5, bytes.length - 1);
      const decodedName = decodeTextTokens(textTokens, true);

      return {
        type: 'partitionData',
        partitionNumber,
        areaNumber,
        armingLevel,
        partitionName: decodedName || `Partition ${partitionNumber}`,
      };
    }

    case ConcordCommand.ZONE_STATUS: {
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

    case ConcordCommand.PANEL_EVENT: {
      if (bytes.length < 4) {
        break;
      }
      const subcommandId = bytes[2];

      switch (subcommandId) {
        case PanelEventSubcommand.ARMING_LEVEL: {
          if (bytes.length < 9) {
            break;
          }
          return {
            type: 'armingLevel',
            partitionNumber: bytes[3],
            areaNumber: bytes[4],
            userNumber: (bytes[5] << 8) | bytes[6],
            armingLevel: bytes[7] as ArmingLevel,
          };
        }

        case PanelEventSubcommand.ALARM_TROUBLE: {
          if (bytes.length < 14) {
            break;
          }
          return {
            type: 'alarmTrouble',
            partitionNumber: bytes[3],
            areaNumber: bytes[4],
            sourceType: bytes[5],
            sourceNumber: (bytes[6] << 16) | (bytes[7] << 8) | bytes[8],
            generalType: bytes[9] as AlarmGeneralType,
            specificType: bytes[10],
            eventSpecificData: (bytes[11] << 8) | bytes[12],
          };
        }

        case PanelEventSubcommand.ENTRY_EXIT_DELAY: {
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

        case PanelEventSubcommand.TOUCHPAD_DISPLAY: {
          if (bytes.length < 7) {
            break;
          }
          const textTokens = bytes.slice(6, bytes.length - 1);
          return {
            type: 'touchpadDisplay',
            partitionNumber: bytes[3],
            areaNumber: bytes[4],
            messageType: bytes[5],
            displayText: decodeTextTokens(textTokens, false),
          };
        }

        case PanelEventSubcommand.FEATURE_STATE: {
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
