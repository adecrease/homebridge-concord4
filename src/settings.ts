import type { PlatformConfig } from 'homebridge';

/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = 'Concord4Alarm';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = 'homebridge-concord4';

export type SensorTypeConfig = 'auto' | 'contact' | 'motion' | 'smoke' | 'co' | 'leak';
export type ResolvedSensorType = 'contact' | 'motion' | 'smoke' | 'co' | 'leak';

export interface PartitionConfigItem {
  partitionNumber: number;
  name?: string;
  exclude?: boolean;
}

export interface ZoneConfigItem {
  zoneNumber: number;
  name?: string;
  sensorType?: SensorTypeConfig;
  exclude?: boolean;
}

export interface Concord4PlatformConfig extends PlatformConfig {
  connectionType?: 'serial' | 'tcp';
  serialPort?: string;
  baudRate?: number;
  tcpHost?: string;
  tcpPort?: number;
  pinCode?: string;
  usePinForArming?: boolean;
  partitions?: PartitionConfigItem[];
  autoDiscoverZones?: boolean;
  zones?: ZoneConfigItem[];
  debugProtocol?: boolean;
}
