"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcpTransport = exports.SerialTransport = void 0;
const node_events_1 = require("node:events");
const net = __importStar(require("node:net"));
const constants_1 = require("./constants");
/**
 * Local RS-232 Serial Port transport using `serialport`.
 * Configured for SuperBus 2000 RS-232 Automation Module (9600 baud, 8 data bits, Odd parity, 1 stop bit).
 */
class SerialTransport extends node_events_1.EventEmitter {
    options;
    port = null;
    connected = false;
    closing = false;
    reconnectTimer = null;
    baudRate;
    reconnectIntervalMs;
    constructor(options) {
        super();
        this.options = options;
        this.baudRate = options.baudRate ?? constants_1.DEFAULT_BAUD_RATE;
        this.reconnectIntervalMs = options.reconnectIntervalMs ?? 5000;
    }
    isConnected() {
        return this.connected;
    }
    async connect() {
        this.closing = false;
        this.clearReconnectTimer();
        const { SerialPort } = await Promise.resolve().then(() => __importStar(require('serialport')));
        return new Promise((resolve, reject) => {
            let settled = false;
            const serial = new SerialPort({
                path: this.options.path,
                baudRate: this.baudRate,
                dataBits: constants_1.DEFAULT_DATA_BITS,
                parity: constants_1.DEFAULT_PARITY,
                stopBits: constants_1.DEFAULT_STOP_BITS,
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
            serial.on('data', (chunk) => {
                this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            serial.on('error', (err) => {
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
    async disconnect() {
        this.closing = true;
        this.clearReconnectTimer();
        const currentPort = this.port;
        this.port = null;
        if (!currentPort || !currentPort.isOpen) {
            this.connected = false;
            return;
        }
        return new Promise((resolve) => {
            currentPort.close(() => {
                this.connected = false;
                resolve();
            });
        });
    }
    async write(data) {
        if (!this.port || !this.connected) {
            throw new Error('SerialTransport is not connected');
        }
        return new Promise((resolve, reject) => {
            this.port.write(data, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.port.drain((drainErr) => {
                    if (drainErr) {
                        reject(drainErr);
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    scheduleReconnect() {
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
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
exports.SerialTransport = SerialTransport;
/**
 * Network TCP socket transport (e.g. `ser2net` or Ethernet-to-RS232 bridge).
 */
class TcpTransport extends node_events_1.EventEmitter {
    options;
    socket = null;
    connected = false;
    closing = false;
    reconnectTimer = null;
    reconnectIntervalMs;
    constructor(options) {
        super();
        this.options = options;
        this.reconnectIntervalMs = options.reconnectIntervalMs ?? 5000;
    }
    isConnected() {
        return this.connected;
    }
    async connect() {
        this.closing = false;
        this.clearReconnectTimer();
        return new Promise((resolve, reject) => {
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
            socket.on('data', (chunk) => {
                this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            socket.on('error', (err) => {
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
    async disconnect() {
        this.closing = true;
        this.clearReconnectTimer();
        const currentSocket = this.socket;
        this.socket = null;
        this.connected = false;
        if (!currentSocket) {
            return;
        }
        return new Promise((resolve) => {
            currentSocket.once('close', () => resolve());
            currentSocket.destroy();
        });
    }
    async write(data) {
        if (!this.socket || !this.connected) {
            throw new Error('TcpTransport is not connected');
        }
        return new Promise((resolve, reject) => {
            this.socket.write(data, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    scheduleReconnect() {
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
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
exports.TcpTransport = TcpTransport;
//# sourceMappingURL=transport.js.map