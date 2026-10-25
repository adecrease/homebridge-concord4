import type { API } from 'homebridge';
import { Concord4Platform } from './platform';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

/**
 * Registers the Concord 4 platform with Homebridge.
 */
export = (api: API): void => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, Concord4Platform);
};
