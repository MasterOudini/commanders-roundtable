// Types for `server.js`, so the app's `.node.test.ts` can boot a real relay
// in-process without the relay itself becoming TypeScript.
//
// ⚠️ The relay stays plain CommonJS JavaScript on purpose: it is deployed on its
// own to a VPS with `npm i && node src/server.js`, and adding a build step to a
// 300-line router that must survive being redeployed by hand would be the wrong
// trade. This file is a declaration only — it is not shipped and not compiled.

import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';

export declare const PROTOCOL_VERSION: number;
export declare const ROOM_ALPHABET: string;
export declare const MAX_MEMBERS: number;
export declare const MAX_MESSAGE_BYTES: number;
export declare const MAX_MESSAGES_PER_SECOND: number;

export declare function newRoomCode(): string;
export declare function isRoomCodeShape(code: unknown): boolean;
export declare function isRoutable(value: unknown): boolean;

export interface RelayOptions {
  readonly now?: () => number;
  readonly log?: (...args: unknown[]) => void;
}

export declare class Relay {
  constructor(options?: RelayOptions);
  readonly rooms: Map<string, unknown>;
  sweep(): void;
  startSweeper(): void;
  stopSweeper(): void;
}

export interface RunningRelay {
  readonly relay: Relay;
  readonly server: Server;
  readonly wss: WebSocketServer;
  listen(port: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export declare function startRelay(options?: RelayOptions): RunningRelay;
