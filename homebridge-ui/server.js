const fs = require('node:fs');
const path = require('node:path');
const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');

class Concord4UiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.onRequest('/equipment', this.handleGetEquipment.bind(this));
    this.onRequest('/serial-ports', this.handleGetSerialPorts.bind(this));

    this.ready();
  }

  async handleGetEquipment() {
    const candidates = [];

    if (this.homebridgeStoragePath) {
      candidates.push(path.join(this.homebridgeStoragePath, 'concord4-equipment.json'));
    }
    candidates.push(path.resolve(__dirname, '..', 'concord4-equipment.json'));

    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          return {
            found: true,
            sourcePath: filePath,
            ...parsed,
          };
        }
      } catch {
        // Try next candidate
      }
    }

    return {
      found: false,
      updatedAt: null,
      connected: false,
      connectionTarget: '',
      partitions: [],
      zones: [],
    };
  }

  async handleGetSerialPorts() {
    try {
      const { SerialPort } = require('serialport');
      const ports = await SerialPort.list();
      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || '',
        serialNumber: p.serialNumber || '',
      }));
    } catch {
      return [];
    }
  }
}

(() => new Concord4UiServer())();
