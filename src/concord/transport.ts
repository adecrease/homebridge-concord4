import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import {
  DEFAULT_BAUD_RATE,
  DEFAULT_DATA_BITS,
  DEFAULT_PARITY,
  DEFAULT_STOP_BITS,
} from './constants';

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
export class SerialTransport extends EventEmitter implements ConcordTransport {
  private port: import('serialport').SerialPort | null = null;
  private connected = false;
  private closing = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly baudRate: number;
  private readonly reconnectIntervalMs: number;

  constructor(private readonly options: SerialTransportOptions) {
    super();
    this.baudRate = options.baudRate ?? DEFAULT_BAUD_RATE;
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? 5000;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<void> {
    this.closing = false;
    this.clearReconnectTimer();

    const { SerialPort } = await import('serialport');

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const serial = new SerialPort({
        path: this.options.path,
        baudRate: this.baudRate,
        dataBits: DEFAULT_DATA_BITS,
        parity: DEFAULT_PARITY,
        stopBits: DEFAULT_STOP_BITS,
        autoOpen: false,
      });

      this.port = serial;

      serial.on('open', () => {
        this.connected = true;
        this.emit('connected');
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      serial.on('data', (chunk: Buffer) => {
        this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      serial.on('error', (err: Error) => {
        this.emit('error', err);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      serial.on('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        if (wasConnected) {
          this.emit('disconnected', 'Serial port closed');
        }
        if (!this.closing) {
          this.scheduleReconnect();
        }
      });

      serial.open((err) => {
        if (err) {
          this.connected = false;
          this.emit('error', err);
          if (!settled) {
            settled = true;
            reject(err);
          }
          if (!this.closing) {
            this.scheduleReconnect();
          }
        }
      });
    });
  }

  public async disconnect(): Promise<void> {
    this.closing = true;
    this.clearReconnectTimer();

    const currentPort = this.port;
    this.port = null;

    if (!currentPort || !currentPort.isOpen) {
      this.connected = false;
      return;
    }

    return new Promise<void>((resolve) => {
      currentPort.close(() => {
        this.connected = false;
        resolve();
      });
    });
  }

  public async write(data: Buffer): Promise<void> {
    if (!this.port || !this.connected) {
      throw new Error('SerialTransport is not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.port!.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.port!.drain((drainErr) => {
          if (drainErr) {
            reject(drainErr);
          } else {
            resolve();
          }
        });
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closing && !this.connected) {
        this.connect().catch(() => {
          // Error already emitted via 'error' event; next reconnect is scheduled automatically
        });
      }
    }, this.reconnectIntervalMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export interface TcpTransportOptions {
  host: string;
  port: number;
  reconnectIntervalMs?: number;
}

/**
 * Network TCP socket transport (e.g. `ser2net` or Ethernet-to-RS232 bridge).
 */
export class TcpTransport extends EventEmitter implements ConcordTransport {
  private socket: net.Socket | null = null;
  private connected = false;
  private closing = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly reconnectIntervalMs: number;

  constructor(private readonly options: TcpTransportOptions) {
    super();
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? 5000;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<void> {
    this.closing = false;
    this.clearReconnectTimer();

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = new net.Socket();
      this.socket = socket;

      socket.setKeepAlive(true, 15000);
      socket.setNoDelay(true);

      socket.on('connect', () => {
        this.connected = true;
        this.emit('connected');
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      socket.on('data', (chunk: Buffer) => {
        this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      socket.on('error', (err: Error) => {
        this.emit('error', err);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      socket.on('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        if (wasConnected) {
          this.emit('disconnected', 'TCP socket closed');
        }
        if (!this.closing) {
          this.scheduleReconnect();
        }
      });

      socket.connect(this.options.port, this.options.host);
    });
  }

  public async disconnect(): Promise<void> {
    this.closing = true;
    this.clearReconnectTimer();

    const currentSocket = this.socket;
    this.socket = null;
    this.connected = false;

    if (!currentSocket) {
      return;
    }

    return new Promise<void>((resolve) => {
      currentSocket.once('close', () => resolve());
      currentSocket.destroy();
    });
  }

  public async write(data: Buffer): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new Error('TcpTransport is not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.write(data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closing && !this.connected) {
        this.connect().catch(() => {
          // Error already emitted via 'error' event; next reconnect is scheduled automatically
        });
      }
    }, this.reconnectIntervalMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
