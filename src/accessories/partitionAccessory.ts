import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { ArmingLevel } from '../concord/constants';
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
export class PartitionAccessoryHandler {
  private readonly service: Service;
  private currentState: PartitionState;
  private pendingTargetState: number | null = null;

  constructor(
    private readonly platform: Concord4Platform,
    private readonly accessory: PlatformAccessory<PartitionAccessoryContext>,
    private readonly client: ConcordClient,
    initialState: PartitionState,
  ) {
    this.currentState = initialState;

    const { Service, Characteristic } = this.platform;
    const displayName =
      this.accessory.context.customName ||
      initialState.name ||
      `Partition ${initialState.partitionNumber}`;

    this.accessory
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'GE / Interlogix')
      .setCharacteristic(Characteristic.Model, 'Concord 4 Partition')
      .setCharacteristic(
        Characteristic.SerialNumber,
        `CONCORD4-P${initialState.partitionNumber}`,
      )
      .setCharacteristic(Characteristic.Name, displayName);

    this.service =
      this.accessory.getService(Service.SecuritySystem) ||
      this.accessory.addService(Service.SecuritySystem, displayName);

    this.service.setCharacteristic(Characteristic.Name, displayName);

    this.service
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(() => this.mapCurrentState(this.currentState));

    this.service
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(() => this.mapTargetState(this.currentState))
      .onSet((value) => this.handleSetTargetState(value));

    this.updateState(initialState);
  }

  public updateState(state: PartitionState): void {
    this.currentState = state;
    const { Characteristic } = this.platform;

    const hkCurrent = this.mapCurrentState(state);
    const hkTarget = this.mapTargetState(state);

    // Clear pending target override once panel reaches a matching state
    if (this.pendingTargetState !== null && this.pendingTargetState === hkTarget) {
      this.pendingTargetState = null;
    }

    if (!state.inAlarm) {
      this.service.updateCharacteristic(Characteristic.SecuritySystemTargetState, hkTarget);
    }

    this.service.updateCharacteristic(Characteristic.SecuritySystemCurrentState, hkCurrent);
    this.service.updateCharacteristic(
      Characteristic.StatusFault,
      state.inTrouble
        ? Characteristic.StatusFault.GENERAL_FAULT
        : Characteristic.StatusFault.NO_FAULT,
    );
    this.service.updateCharacteristic(
      Characteristic.StatusTampered,
      state.inAlarm
        ? Characteristic.StatusTampered.TAMPERED
        : Characteristic.StatusTampered.NOT_TAMPERED,
    );
  }

  private mapCurrentState(state: PartitionState): number {
    const { Characteristic } = this.platform;

    if (state.inAlarm) {
      return Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
    }

    switch (state.armingLevel) {
      case ArmingLevel.AWAY:
        return Characteristic.SecuritySystemCurrentState.AWAY_ARM;

      case ArmingLevel.NIGHT:
        return Characteristic.SecuritySystemCurrentState.NIGHT_ARM;

      case ArmingLevel.STAY:
      case ArmingLevel.SILENT:
        return state.noDelay
          ? Characteristic.SecuritySystemCurrentState.NIGHT_ARM
          : Characteristic.SecuritySystemCurrentState.STAY_ARM;

      case ArmingLevel.OFF:
      default:
        return Characteristic.SecuritySystemCurrentState.DISARMED;
    }
  }

  private mapTargetState(state: PartitionState): number {
    const { Characteristic } = this.platform;

    if (this.pendingTargetState !== null) {
      return this.pendingTargetState;
    }

    switch (state.armingLevel) {
      case ArmingLevel.AWAY:
        return Characteristic.SecuritySystemTargetState.AWAY_ARM;

      case ArmingLevel.NIGHT:
        return Characteristic.SecuritySystemTargetState.NIGHT_ARM;

      case ArmingLevel.STAY:
      case ArmingLevel.SILENT:
        return state.noDelay
          ? Characteristic.SecuritySystemTargetState.NIGHT_ARM
          : Characteristic.SecuritySystemTargetState.STAY_ARM;

      case ArmingLevel.OFF:
      default:
        return Characteristic.SecuritySystemTargetState.DISARM;
    }
  }

  private async handleSetTargetState(value: CharacteristicValue): Promise<void> {
    const { Characteristic } = this.platform;
    const target = Number(value);
    const partitionNum = this.currentState.partitionNumber;

    this.pendingTargetState = target;

    try {
      switch (target) {
        case Characteristic.SecuritySystemTargetState.STAY_ARM:
          this.platform.log.info(`Arming Partition ${partitionNum} to Stay...`);
          await this.client.armStay(partitionNum);
          break;

        case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
          this.platform.log.info(
            `Arming Partition ${partitionNum} to Night (Stay + No Entry Delay)...`,
          );
          await this.client.armNight(partitionNum);
          break;

        case Characteristic.SecuritySystemTargetState.AWAY_ARM:
          this.platform.log.info(`Arming Partition ${partitionNum} to Away...`);
          await this.client.armAway(partitionNum);
          break;

        case Characteristic.SecuritySystemTargetState.DISARM:
          this.platform.log.info(`Disarming Partition ${partitionNum}...`);
          await this.client.disarm(partitionNum);
          break;

        default:
          this.platform.log.warn(`Unsupported SecuritySystemTargetState value: ${target}`);
          break;
      }
    } catch (err) {
      this.pendingTargetState = null;
      const message = err instanceof Error ? err.message : String(err);
      this.platform.log.error(
        `Failed to set target state on Partition ${partitionNum}: ${message}`,
      );
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }
}
