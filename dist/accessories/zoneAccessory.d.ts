import type { PlatformAccessory } from 'homebridge';
import type { ZoneState } from '../concord/client';
import type { Concord4Platform } from '../platform';
import type { ResolvedSensorType } from '../settings';
export interface ZoneAccessoryContext {
    kind: 'zone';
    zoneNumber: number;
    sensorType: ResolvedSensorType;
    customName?: string;
}
/**
 * Exposes a Concord 4 Zone as a HomeKit Contact, Motion, Smoke, CO, or Leak sensor accessory.
 */
export declare class ZoneAccessoryHandler {
    private readonly platform;
    private readonly accessory;
    private readonly sensorType;
    private readonly service;
    private currentState;
    constructor(platform: Concord4Platform, accessory: PlatformAccessory<ZoneAccessoryContext>, initialState: ZoneState, sensorType: ResolvedSensorType);
    getSensorType(): ResolvedSensorType;
    updateState(state: ZoneState): void;
    private ensureSensorService;
}
