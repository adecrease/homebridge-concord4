"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZoneAccessoryHandler = void 0;
const constants_1 = require("../concord/constants");
/**
 * Exposes a Concord 4 Zone as a HomeKit Contact, Motion, Smoke, CO, or Leak sensor accessory.
 */
class ZoneAccessoryHandler {
    platform;
    accessory;
    sensorType;
    service;
    currentState;
    constructor(platform, accessory, initialState, sensorType) {
        this.platform = platform;
        this.accessory = accessory;
        this.sensorType = sensorType;
        this.currentState = initialState;
        const { Service, Characteristic } = this.platform;
        const displayName = this.accessory.context.customName ||
            initialState.name ||
            `Zone ${initialState.zoneNumber}`;
        const modelName = initialState.zoneType === constants_1.ZoneType.RF
            ? `Concord 4 Wireless Zone (Group ${initialState.groupNumber})`
            : `Concord 4 Hardwired Zone (Group ${initialState.groupNumber})`;
        this.accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, 'GE / Interlogix')
            .setCharacteristic(Characteristic.Model, modelName)
            .setCharacteristic(Characteristic.SerialNumber, `CONCORD4-Z${String(initialState.zoneNumber).padStart(2, '0')}`)
            .setCharacteristic(Characteristic.Name, displayName);
        this.service = this.ensureSensorService(sensorType, displayName);
        this.updateState(initialState);
    }
    getSensorType() {
        return this.sensorType;
    }
    updateState(state) {
        this.currentState = state;
        const { Characteristic } = this.platform;
        const isActive = state.tripped || state.alarm;
        switch (this.sensorType) {
            case 'contact':
                this.service.updateCharacteristic(Characteristic.ContactSensorState, isActive
                    ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
                    : Characteristic.ContactSensorState.CONTACT_DETECTED);
                break;
            case 'motion':
                this.service.updateCharacteristic(Characteristic.MotionDetected, isActive);
                break;
            case 'smoke':
                this.service.updateCharacteristic(Characteristic.SmokeDetected, isActive
                    ? Characteristic.SmokeDetected.SMOKE_DETECTED
                    : Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
                break;
            case 'co':
                this.service.updateCharacteristic(Characteristic.CarbonMonoxideDetected, isActive
                    ? Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
                    : Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL);
                break;
            case 'leak':
                this.service.updateCharacteristic(Characteristic.LeakDetected, isActive
                    ? Characteristic.LeakDetected.LEAK_DETECTED
                    : Characteristic.LeakDetected.LEAK_NOT_DETECTED);
                break;
        }
        // Common diagnostic characteristics across all HomeKit sensor services
        this.service.updateCharacteristic(Characteristic.StatusActive, !state.bypassed);
        this.service.updateCharacteristic(Characteristic.StatusFault, state.faulted || state.trouble
            ? Characteristic.StatusFault.GENERAL_FAULT
            : Characteristic.StatusFault.NO_FAULT);
        this.service.updateCharacteristic(Characteristic.StatusTampered, state.alarm || state.trouble
            ? Characteristic.StatusTampered.TAMPERED
            : Characteristic.StatusTampered.NOT_TAMPERED);
    }
    ensureSensorService(targetType, displayName) {
        const { Service, Characteristic } = this.platform;
        const serviceMap = {
            contact: Service.ContactSensor,
            motion: Service.MotionSensor,
            smoke: Service.SmokeSensor,
            co: Service.CarbonMonoxideSensor,
            leak: Service.LeakSensor,
        };
        // Remove any previous sensor service if the user changed sensorType override in config
        for (const [typeKey, ServiceClass] of Object.entries(serviceMap)) {
            if (typeKey !== targetType) {
                const oldService = this.accessory.getService(ServiceClass);
                if (oldService) {
                    this.accessory.removeService(oldService);
                }
            }
        }
        const TargetServiceClass = serviceMap[targetType];
        const service = this.accessory.getService(TargetServiceClass) ||
            this.accessory.addService(TargetServiceClass, displayName);
        service.setCharacteristic(Characteristic.Name, displayName);
        return service;
    }
}
exports.ZoneAccessoryHandler = ZoneAccessoryHandler;
//# sourceMappingURL=zoneAccessory.js.map