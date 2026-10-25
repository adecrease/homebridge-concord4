import { EventEmitter } from 'node:events';
export interface ConcordTransport extends EventEmitter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    write(data: Buffer): Promise<void>;
    isConnected(): boolean;
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'connected', listener: () => void): this;
    on(event: 'disconnected', listener: (reason?: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
}
export interface SerialTransportOptions {
    path: string;
    baudRate?: number;
    reconnectIntervalMs?: number;
}
/**
 * Local RS-232 Serial Port transport using `serialport`.
 * Configured for SuperBus 2000 RS-232 Automation Module (9600 baud, 8 data bits, Odd parity, 1 stop bit).
 */
export declare class SerialTransport extends EventEmitter implements ConcordTransport {
    private readonly options;
    private port;
    private connected;
    private closing;
    private reconnectTimer;
    private readonly baudRate;
    private readonly reconnectIntervalMs;
    constructor(options: SerialTransportOptions);
    isConnected(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    write(data: Buffer): Promise<void>;
    private scheduleReconnect;
    private clearReconnectTimer;
}
export interface TcpTransportOptions {
    host: string;
    port: number;
    reconnectIntervalMs?: number;
}
/**
 * Network TCP socket transport (e.g. `ser2net` or Ethernet-to-RS232 bridge).
 */
export declare class TcpTransport extends EventEmitter implements ConcordTransport {
    private readonly options;
    private socket;
    private connected;
    private closing;
    private reconnectTimer;
    private readonly reconnectIntervalMs;
    constructor(options: TcpTransportOptions);
    isConnected(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    write(data: Buffer): Promise<void>;
    private scheduleReconnect;
    private clearReconnectTimer;
}
