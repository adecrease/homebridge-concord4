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
export type StreamToken = {
    type: 'ack';
} | {
    type: 'nak';
} | {
    type: 'frame';
    frame: DecodedConcordFrame;
};
/**
 * Computes the 8-bit modulo-256 sum of an array of byte values.
 */
export declare function computeChecksum(bytes: readonly number[]): number;
/**
 * Converts a byte value (0-255) to a 2-character uppercase hex string.
 */
export declare function byteToHex(byte: number): string;
/**
 * Encodes a binary command payload `[CMD, ...DATA]` into a wire-ready Buffer
 * starting with `0x0A` (LF) followed by uppercase ASCII hex of `[LI, CMD, ...DATA, CS]`.
 */
export declare function encodeCommandFrame(payload: readonly number[]): Buffer;
/**
 * Decodes and validates an ASCII hex string (without the leading 0x0A LF).
 */
export declare function decodeHexFrame(asciiHex: string): DecodedConcordFrame;
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
export declare class ConcordFrameParser {
    private inFrame;
    private currentHex;
    private expectedHexLength;
    /**
     * Feeds a chunk of raw bytes from the serial port or TCP socket and returns
     * any completed control tokens or frames in order.
     */
    push(chunk: Buffer): StreamToken[];
    resetFrame(): void;
}
