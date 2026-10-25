import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { ConcordClient } from '../src/concord/client';
import {
  ArmingLevel,
  CONTROL_ACK,
  CONTROL_LF,
  ConcordCommand,
  FeatureStateFlags,
  KeypressCode,
  PanelEventSubcommand,
  ZoneStateFlags,
  ZoneType,
  decodeTextTokens,
  inferSensorType,
} from '../src/concord/constants';
import {
  ConcordFrameParser,
  computeChecksum,
  decodeHexFrame,
  encodeCommandFrame,
} from '../src/concord/frame';
import { parseConcordFrame } from '../src/concord/parser';
import type { ConcordTransport } from '../src/concord/transport';

class MockTransport extends EventEmitter implements ConcordTransport {
  public connected = false;
  public writtenBuffers: Buffer[] = [];
  public autoAck = true;

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  public async write(data: Buffer): Promise<void> {
    this.writtenBuffers.push(data);
    // If client wrote a command frame (starts with 0x0A) and autoAck is on, simulate panel ACK (0x06)
    if (this.autoAck && data[0] === CONTROL_LF) {
      setImmediate(() => {
        this.emit('data', Buffer.from([CONTROL_ACK]));
      });
    }
  }

  public simulatePanelPayload(payload: readonly number[]): void {
    const wire = encodeCommandFrame(payload);
    this.emit('data', wire);
  }
}

describe('Concord 4 RS-232 Protocol & Client', () => {
  it('encodes and decodes frames with valid modulo-256 checksums', () => {
    // 0x02 Equipment List Request -> [0x02, 0x02, 0x04]
    const eqListWire = encodeCommandFrame([ConcordCommand.EQUIPMENT_LIST_REQUEST]);
    assert.equal(eqListWire[0], CONTROL_LF);
    assert.equal(eqListWire.subarray(1).toString('ascii'), '020204');

    const decoded = decodeHexFrame('020204');
    assert.equal(decoded.valid, true);
    assert.deepEqual(decoded.bytes, [0x02, 0x02, 0x04]);

    // Dynamic Data Refresh Request -> [0x02, 0x20, 0x22]
    const refreshWire = encodeCommandFrame([ConcordCommand.CLEAR_AUTOMATION_IMAGE]);
    assert.equal(refreshWire.subarray(1).toString('ascii'), '022022');
  });

  it('rejects frames with bad checksums or mismatched lengths', () => {
    const badChecksum = decodeHexFrame('020205');
    assert.equal(badChecksum.valid, false);
    assert.match(badChecksum.reason ?? '', /Checksum mismatch/);

    const badLength = decodeHexFrame('040204');
    assert.equal(badLength.valid, false);
    assert.match(badLength.reason ?? '', /Length mismatch/);
  });

  it('parses chunked byte streams immediately upon reaching LI byte count', () => {
    const parser = new ConcordFrameParser();
    // Zone 1 tripped: [0x07, 0x21, 0x01, 0x00, 0x00, 0x01, 0x01, CS]
    const wire = encodeCommandFrame([
      ConcordCommand.ZONE_STATUS,
      0x01,
      0x00,
      0x00,
      0x01,
      ZoneStateFlags.TRIPPED,
    ]);

    // Feed in 3 separate chunks plus a leading ACK byte
    const chunk1 = Buffer.concat([Buffer.from([CONTROL_ACK]), wire.subarray(0, 4)]);
    const chunk2 = wire.subarray(4, 10);
    const chunk3 = wire.subarray(10);

    const out1 = parser.push(chunk1);
    assert.equal(out1.length, 1);
    assert.equal(out1[0].type, 'ack');

    const out2 = parser.push(chunk2);
    assert.equal(out2.length, 0);

    const out3 = parser.push(chunk3);
    assert.equal(out3.length, 1);
    assert.equal(out3[0].type, 'frame');
    if (out3[0].type === 'frame') {
      assert.equal(out3[0].frame.valid, true);
      const parsed = parseConcordFrame(out3[0].frame.bytes);
      assert.equal(parsed.type, 'zoneStatus');
      if (parsed.type === 'zoneStatus') {
        assert.equal(parsed.partitionNumber, 1);
        assert.equal(parsed.zoneNumber, 1);
        assert.equal(parsed.state.tripped, true);
      }
    }
  });

  it('decodes text tokens and infers HomeKit sensor types accurately', () => {
    // 0x6E = 'FRONT', 0x57 = 'DOOR'
    const frontDoor = decodeTextTokens([0x6e, 0x57]);
    assert.equal(frontDoor, 'Front Door');
    assert.equal(inferSensorType(10, frontDoor), 'contact');

    // Spelled 'D','E','N' + 0x92 ('MOTION')
    const denMotion = decodeTextTokens([0x14, 0x15, 0x1e, 0x92]);
    assert.equal(denMotion, 'Den Motion');
    assert.equal(inferSensorType(17, denMotion), 'motion');

    // Group 26 Fire/Smoke
    const hallwaySmoke = decodeTextTokens([0x74, 0xb8]);
    assert.equal(hallwaySmoke, 'Hall Smoke');
    assert.equal(inferSensorType(26, hallwaySmoke), 'smoke');

    // Group 34 CO
    assert.equal(inferSensorType(34, 'Basement Detector'), 'co');

    // Group 38 Water/Leak
    assert.equal(inferSensorType(38, 'Laundry Sensor'), 'leak');
  });

  it('tracks zones, partitions, Night (No-Delay) state, and sends arm/disarm commands', async () => {
    const transport = new MockTransport();
    const client = new ConcordClient({ transport });

    await client.start();

    // Simulate panel sending Zone 3 (Group 17 Interior Motion, Name: LIVING MOTION)
    transport.simulatePanelPayload([
      ConcordCommand.ZONE_DATA,
      0x01, // Partition 1
      0x00, // Area 0
      17, // Group 17 (Interior Motion)
      0x00,
      0x03, // Zone 3
      ZoneType.HARDWIRED,
      ZoneStateFlags.NORMAL,
      0x8a, // 'LIVING'
      0x92, // 'MOTION'
    ]);

    const zone3 = client.getZone(3);
    assert.ok(zone3);
    assert.equal(zone3.name, 'Living Motion');
    assert.equal(zone3.inferredSensorType, 'motion');
    assert.equal(zone3.tripped, false);

    // Simulate Night Arming command from client -> sends [0x40, 0x01, 0x00, 0x28, 0x04]
    await client.armNight(1);
    const lastTx = transport.writtenBuffers[transport.writtenBuffers.length - 1];
    const expectedNightFrame = encodeCommandFrame([
      ConcordCommand.KEYPRESS,
      0x01,
      0x00,
      KeypressCode.KEYFOB_DIRECT_ARM_STAY,
      KeypressCode.DIGIT_4_NO_DELAY,
    ]);
    assert.deepEqual(lastTx, expectedNightFrame);

    // Simulate panel reporting Arming Level = STAY (2) + Feature State = NO_DELAY (0x04)
    transport.simulatePanelPayload([
      ConcordCommand.PANEL_EVENT,
      PanelEventSubcommand.ARMING_LEVEL,
      0x01,
      0x00,
      0x00,
      0xf9,
      ArmingLevel.STAY,
    ]);
    transport.simulatePanelPayload([
      ConcordCommand.PANEL_EVENT,
      PanelEventSubcommand.FEATURE_STATE,
      0x01,
      0x00,
      FeatureStateFlags.NO_DELAY | FeatureStateFlags.CHIME,
    ]);

    const partition1 = client.getPartition(1);
    assert.ok(partition1);
    assert.equal(partition1.armingLevel, ArmingLevel.STAY);
    assert.equal(partition1.noDelay, true);
    assert.equal(partition1.chime, true);

    await client.stop();
  });
});
