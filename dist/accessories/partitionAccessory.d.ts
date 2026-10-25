import type { PlatformAccessory } from 'homebridge';
import type { ConcordClient, PartitionState } from '../concord/client';
import type { Concord4Platform } from '../platform';
export interface PartitionAccessoryContext {
    kind: 'partition';
    partitionNumber: number;
    customName?: string;
}
/**
 * Exposes a Concord 4 Partition as a HomeKit `SecuritySystem` accessory.
 */
export declare class PartitionAccessoryHandler {
    private readonly platform;
    private readonly accessory;
    private readonly client;
    private readonly service;
    private currentState;
    private pendingTargetState;
    constructor(platform: Concord4Platform, accessory: PlatformAccessory<PartitionAccessoryContext>, client: ConcordClient, initialState: PartitionState);
    updateState(state: PartitionState): void;
    private mapCurrentState;
    private mapTargetState;
    private handleSetTargetState;
}
