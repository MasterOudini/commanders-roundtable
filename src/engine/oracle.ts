// The oracle database the engine reads. Built once per game from the CardData
// the renderer already holds, so a game needs ~400 entries rather than 113,559.
//
// ⚠️ Keyed by PRINTING, not by oracle id. Two players can bring different
// printings of Sol Ring and each must see their own art; the rules are keyed off
// `oracleId`, which every entry also carries. Building the index the other way
// round would make the engine correct and the table wrong.

import type { CardData } from '../data/cardTypes';
import { parseFace } from '../data/oracleParse';
import type { OracleCard, OracleDb, IngestWarnings } from './types/oracle';
import type { OracleId, PrintingId } from './types/ids';

export interface IngestResult {
  readonly db: OracleDb;
  readonly warnings: IngestWarnings;
  readonly cards: number;
}

/** The face-down sentinel. Every viewer but the controller sees this oracle id. */
export const FACE_DOWN_ORACLE_ID: OracleId = '__facedown__';

export function toOracleCard(data: CardData, warn: (c: string) => void): OracleCard {
  const faces = data.faces.map((_, i) => parseFace(data, i, warn));
  const first = faces[0];
  if (!first) throw new Error(`card ${data.scryfallId} has no faces`);
  const isBasicLand = first.typeLine.supertypes.includes('Basic') && first.typeLine.types.includes('Land');
  return {
    oracleId: data.oracleId,
    printingId: data.scryfallId,
    name: data.name,
    layout: data.layout,
    faces,
    colorIdentity: data.colorIdentity,
    manaValue: data.cmc,
    commanderLegality: data.commanderLegality,
    isBasicLand,
    data,
  };
}

class MapOracleDb implements OracleDb {
  private readonly byPrintingMap = new Map<PrintingId, OracleCard>();
  private readonly byOracleMap = new Map<OracleId, OracleCard>();
  private readonly byNameMap = new Map<string, OracleCard>();

  constructor(cards: readonly OracleCard[]) {
    for (const card of cards) {
      this.byPrintingMap.set(card.printingId, card);
      if (!this.byOracleMap.has(card.oracleId)) this.byOracleMap.set(card.oracleId, card);
      const key = card.name.toLowerCase();
      if (!this.byNameMap.has(key)) this.byNameMap.set(key, card);
      // A split/adventure card is also reachable by either half's name, which is
      // what makes `byName('Fire')` work in a test fixture.
      for (const face of card.faces) {
        const fk = face.name.toLowerCase();
        if (!this.byNameMap.has(fk)) this.byNameMap.set(fk, card);
      }
    }
  }

  byPrinting(id: PrintingId): OracleCard | undefined {
    return this.byPrintingMap.get(id);
  }

  byOracle(id: OracleId): OracleCard | undefined {
    return this.byOracleMap.get(id);
  }

  byName(name: string): OracleCard | undefined {
    return this.byNameMap.get(name.toLowerCase());
  }

  get size(): number {
    return this.byPrintingMap.size;
  }
}

/**
 * Ingest a set of printings.
 *
 * Warnings are counted by CATEGORY rather than listed, because the number is
 * the point: "1,412 cards produced a `mana:variableAmount` warning" is a
 * measurement of Tier-2 coverage that belongs in DECISIONS.md, whereas 1,412
 * individual strings are noise.
 */
export function ingestOracle(cards: readonly CardData[]): IngestResult {
  const warnings: Record<string, number> = {};
  const warn = (category: string): void => {
    warnings[category] = (warnings[category] ?? 0) + 1;
  };
  const parsed: OracleCard[] = [];
  for (const data of cards) {
    try {
      parsed.push(toOracleCard(data, warn));
    } catch {
      warn('card:threw');
    }
  }
  return { db: new MapOracleDb(parsed), warnings, cards: parsed.length };
}

export function createOracleDb(cards: readonly CardData[]): OracleDb {
  return ingestOracle(cards).db;
}

export const EMPTY_ORACLE: OracleDb = new MapOracleDb([]);

/** The face a card is currently showing, defaulting to the front. */
export function faceOf(card: OracleCard, faceIndex: number): OracleCard['faces'][number] {
  const face = card.faces[faceIndex] ?? card.faces[0];
  if (!face) throw new Error(`card ${card.printingId} has no faces`);
  return face;
}
