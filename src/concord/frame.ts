import { CONTROL_ACK, CONTROL_LF, CONTROL_NAK } from './constants';

export interface DecodedConcordFrame {
  valid: boolean;
  /**
   * Full decoded binary bytes: [LI, CMD, ...DATA, CS]
   */
  bytes: number[];
  /**
   * Raw uppercase ASCII hex string (excluding leading 0x0A LF).
   */
  rawHex: string;
  reason?: string;
}

export type StreamToken =
  | { type: 'ack' }
  | { type: 'nak' }
  | { type: 'frame'; frame: DecodedConcordFrame };

/**
 * Computes the 8-bit modulo-256 sum of an array of byte values.
 */
export function computeChecksum(bytes: readonly number[]): number {
  let sum = 0;
  for (const b of bytes) {
    sum = (sum + (b & 0xff)) & 0xff;
  }
  return sum;
}

/**
 * Converts a byte value (0-255) to a 2-character uppercase hex string.
 */
export function byteToHex(byte: number): string {
  return (byte & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Encodes a binary command payload `[CMD, ...DATA]` into a wire-ready Buffer
 * starting with `0x0A` (LF) followed by uppercase ASCII hex of `[LI, CMD, ...DATA, CS]`.
 */
export function encodeCommandFrame(payload: readonly number[]): Buffer {
  if (payload.length === 0) {
    throw new Error('Cannot encode an empty Concord command payload.');
  }

  const lastIndex = payload.length + 1; // Includes payload bytes + 1 checksum byte
  const headerAndPayload = [lastIndex, ...payload];
  const checksum = computeChecksum(headerAndPayload);
  const fullBinary = [...headerAndPayload, checksum];

  const asciiHex = fullBinary.map(byteToHex).join('');
  return Buffer.from([CONTROL_LF, ...Buffer.from(asciiHex, 'ascii')]);
}

/**
 * Decodes and validates an ASCII hex string (without the leading 0x0A LF).
 */
export function decodeHexFrame(asciiHex: string): DecodedConcordFrame {
  const cleaned = asciiHex.trim().toUpperCase();

  if (cleaned.length < 6 || cleaned.length % 2 !== 0) {
    return {
      valid: false,
      bytes: [],
      rawHex: cleaned,
      reason: `Invalid hex frame length (${cleaned.length} chars)`,
    };
  }

  if (!/^[0-9A-F]+$/.test(cleaned)) {
    return {
      valid: false,
      bytes: [],
      rawHex: cleaned,
      reason: 'Frame contains non-hexadecimal characters',
    };
  }

  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(Number.parseInt(cleaned.slice(i, i + 2), 16));
  }

  const expectedLastIndex = bytes[0];
  if (expectedLastIndex !== bytes.length - 1) {
    return {
      valid: false,
      bytes,
      rawHex: cleaned,
      reason: `Length mismatch: LI=${expectedLastIndex}, actual following bytes=${bytes.length - 1}`,
    };
  }

  const receivedChecksum = bytes[bytes.length - 1];
  const calculatedChecksum = computeChecksum(bytes.slice(0, -1));
  if (receivedChecksum !== calculatedChecksum) {
    return {
      valid: false,
      bytes,
      rawHex: cleaned,
      reason: `Checksum mismatch: expected 0x${byteToHex(calculatedChecksum)}, got 0x${byteToHex(receivedChecksum)}`,
    };
  }

  return {
    valid: true,
    bytes,
    rawHex: cleaned,
  };
}

/**
 * Stateful byte-stream parser for the SuperBus 2000 RS-232 interface.
 *
 * Handles:
 * - Immediate emission of `0x06` (ACK) and `0x15` (NAK) control bytes.
 * - Frame start on `0x0A` (LF).
 * - Exact length-based frame completion using the first two hex characters (`LI`),
 *   so frames are emitted the instant their checksum byte arrives without waiting for
 *   any trailing delimiter.
 */
export class ConcordFrameParser {
  private inFrame = false;
  private currentHex = '';
  private expectedHexLength: number | null = null;

  /**
   * Feeds a chunk of raw bytes from the serial port or TCP socket and returns
   * any completed control tokens or frames in order.
   */
  public push(chunk: Buffer): StreamToken[] {
    const tokens: StreamToken[] = [];

    for (const byte of chunk) {
      if (byte === CONTROL_ACK) {
        tokens.push({ type: 'ack' });
        continue;
      }

      if (byte === CONTROL_NAK) {
        tokens.push({ type: 'nak' });
        continue;
      }

      if (byte === CONTROL_LF) {
        // If a previous incomplete frame was buffered, emit it as invalid for diagnostics before resetting
        if (this.inFrame && this.currentHex.length > 0) {
          tokens.push({
            type: 'frame',
            frame: decodeHexFrame(this.currentHex),
          });
        }
        this.inFrame = true;
        this.currentHex = '';
        this.expectedHexLength = null;
        continue;
      }

      // Ignore stray CR (0x0D) or whitespace outside/inside frames
      if (byte === 0x0d || byte === 0x20 || byte === 0x09) {
        continue;
      }

      if (!this.inFrame) {
        continue;
      }

      const char = String.fromCharCode(byte);
      this.currentHex += char;

      // Once we have the first 2 hex chars, we know LI (Byte 0) and the exact total hex length: (LI + 1) * 2
      if (this.currentHex.length === 2 && this.expectedHexLength === null) {
        const li = Number.parseInt(this.currentHex, 16);
        if (Number.isNaN(li) || li < 2) {
          // Invalid LI byte; emit invalid frame and reset
          tokens.push({
            type: 'frame',
            frame: decodeHexFrame(this.currentHex),
          });
          this.resetFrame();
          continue;
        }
        this.expectedHexLength = (li + 1) * 2;
      }

      if (this.expectedHexLength !== null && this.currentHex.length >= this.expectedHexLength) {
        tokens.push({
          type: 'frame',
          frame: decodeHexFrame(this.currentHex),
        });
        this.resetFrame();
      }
    }

    return tokens;
  }

  public resetFrame(): void {
    this.inFrame = false;
    this.currentHex = '';
    this.expectedHexLength = null;
  }
}
