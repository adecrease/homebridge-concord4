import { AlarmGeneralType, ArmingLevel, ZoneType } from './constants';
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
export type ConcordParsedMessage = {
    type: 'automationEventLost';
} | {
    type: 'equipmentListComplete';
} | {
    type: 'clearAutomationImage';
} | {
    type: 'zoneData';
    partitionNumber: number;
    areaNumber: number;
    groupNumber: number;
    zoneNumber: number;
    zoneType: ZoneType;
    state: ZoneStateBreakdown;
    zoneName: string;
} | {
    type: 'partitionData';
    partitionNumber: number;
    areaNumber: number;
    armingLevel: ArmingLevel;
    partitionName: string;
} | {
    type: 'zoneStatus';
    partitionNumber: number;
    areaNumber: number;
    zoneNumber: number;
    state: ZoneStateBreakdown;
} | {
    type: 'armingLevel';
    partitionNumber: number;
    areaNumber: number;
    userNumber: number;
    armingLevel: ArmingLevel;
} | {
    type: 'alarmTrouble';
    partitionNumber: number;
    areaNumber: number;
    sourceType: number;
    sourceNumber: number;
    generalType: AlarmGeneralType;
    specificType: number;
    eventSpecificData: number;
} | {
    type: 'entryExitDelay';
    partitionNumber: number;
    areaNumber: number;
    delayFlags: number;
    isExitDelay: boolean;
    isEndDelay: boolean;
    delaySeconds: number;
} | {
    type: 'touchpadDisplay';
    partitionNumber: number;
    areaNumber: number;
    messageType: number;
    displayText: string;
} | {
    type: 'featureState';
    partitionNumber: number;
    areaNumber: number;
    features: FeatureStateBreakdown;
} | {
    type: 'unknown';
    commandId: number;
    subcommandId?: number;
    bytes: readonly number[];
};
export declare function parseZoneState(mask: number): ZoneStateBreakdown;
export declare function parseFeatureState(mask: number): FeatureStateBreakdown;
/**
 * Parses a validated binary Concord frame `[LI, CMD, ...DATA, CS]` into a typed message object.
 */
export declare function parseConcordFrame(bytes: readonly number[]): ConcordParsedMessage;
