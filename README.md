# homebridge-concord4

A native TypeScript Homebridge plugin for **GE / Interlogix Concord 4** security panels equipped with the **SuperBus 2000 RS-232 Automation Module** (`60-783-02`).

Unlike wrapper approaches that require running a separate Python `concord232` daemon and polling over HTTP, `homebridge-concord4` implements the SuperBus 2000 RS-232 protocol directly in Node.js for **instant, event-driven sensor and alarm updates** with zero external runtime dependencies.

---

## Features

- **Native RS-232 & TCP Support:** Connect directly via a local USB-to-RS232 adapter (`/dev/ttyUSB0`, `/dev/tty.usbserial-*`) or over the network via `ser2net` / Ethernet-to-Serial bridges.
- **Full HomeKit `SecuritySystem` Integration:**
  - **Stay (`STAY_ARM`):** Arms perimeter to Level 2 (Stay) with standard entry/exit delay.
  - **Night (`NIGHT_ARM`):** Arms perimeter to Level 2 (Stay) + **Instant / No Entry Delay** (`Keypress 0x04`), and automatically detects `No Delay` state changes made from physical keypads via Concord Feature State (`0x22 0x0C`) frames.
  - **Away (`AWAY_ARM`):** Arms perimeter and interior to Level 3 (Away).
  - **Disarm (`DISARM`):** Disarms the partition via direct Keyfob command (`0x20`) or optional 4-digit PIN sequence.
  - **Alarm & Trouble Tracking:** Real-time `ALARM_TRIGGERED`, `StatusFault`, and `StatusTampered` reporting.
- **Automatic Zone Discovery & Type Inference:**
  - Queries the panel's Equipment List (`0x02`) and decodes programmed Concord word tokens (`Zone Data 0x03`) so zones appear with their real names (e.g., *Front Door*, *Living Motion*, *Hall Smoke*).
  - Automatically infers the HomeKit sensor service (`ContactSensor`, `MotionSensor`, `SmokeSensor`, `CarbonMonoxideSensor`, or `LeakSensor`) from the Concord Zone Group (`GN`) and zone name, with per-zone config overrides and exclusions.

---

## Hardware Requirements

1. **GE / Interlogix Concord 4 Panel** (or compatible Concord Express / Ultra).
2. **SuperBus 2000 RS-232 Automation Module** wired to the panel's 4-wire SuperBus (`9600` baud, `8` data bits, `Odd` parity, `1` stop bit).
   > **Important:** After wiring the SuperBus 2000 RS-232 module, ensure the panel has performed a bus device learn (or power-cycle the panel) so the Automation Module is registered on the SuperBus.
3. **USB-to-RS232 Serial Cable** (FTDI or Prolific chipset recommended) connected to your Homebridge host, **or** a network Serial-to-IP bridge (`ser2net`, USR-TCP232, etc.).

---

## Installation & Build

```bash
cd /Users/anthonydecrease/Developer/homebridge-concord4
npm install
npm run build
npm test
```

To link the plugin into a local Homebridge installation for development:

```bash
npm link
```

---

## Configuration Example (`config.json`)

You can configure the plugin visually through the **Homebridge UI** (`config.schema.json` is included) or by adding the following block to the `platforms` array in your Homebridge `config.json`:

```json
{
  "platform": "Concord4Alarm",
  "name": "Home Security",
  "connectionType": "serial",
  "serialPort": "/dev/ttyUSB0",
  "baudRate": 9600,
  "usePinForArming": false,
  "autoDiscoverZones": true,
  "zones": [
    {
      "zoneNumber": 1,
      "name": "Front Entry Door",
      "sensorType": "contact"
    },
    {
      "zoneNumber": 4,
      "name": "Family Room Motion",
      "sensorType": "motion"
    },
    {
      "zoneNumber": 15,
      "exclude": true
    }
  ],
  "debugProtocol": false
}
```

### Using a Network Serial Bridge (`ser2net`)

If your Concord 4 panel is connected to a Raspberry Pi running `ser2net`, configure `/etc/ser2net.yaml` for `9600n81` -> **Odd parity** (`9600bps 8DATABITS ODD 1STOPBIT`), and set:

```json
{
  "platform": "Concord4Alarm",
  "name": "Home Security",
  "connectionType": "tcp",
  "tcpHost": "192.168.1.50",
  "tcpPort": 2000,
  "autoDiscoverZones": true
}
```

---

## Concord 4 Zone Group Auto-Detection Reference

| Concord Zone Group (`GN`) | Default HomeKit Service | Description |
| :--- | :--- | :--- |
| **Groups `10`–`13`, `19`, `25`, `35`** | `ContactSensor` | Entry/Exit Doors, Perimeter Doors/Windows, Local Chime |
| **Groups `14`–`18`, `20`** | `MotionSensor` | Interior Follower & Interior Motion PIRs |
| **Group `26`** | `SmokeSensor` | 24-Hour Fire / Smoke / Heat Detectors |
| **Group `34`** | `CarbonMonoxideSensor` | 24-Hour Carbon Monoxide (CO) Detectors |
| **Group `38`** | `LeakSensor` | 24-Hour Water / Flood / Moisture Sensors |
