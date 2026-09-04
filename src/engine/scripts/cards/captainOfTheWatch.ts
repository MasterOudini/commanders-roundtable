// `Captain of the Watch` - a layer-6 anthem: "Other Soldier creatures you control get +1/+1 and have vigilance". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Plus its second line: create three 1/1 white Soldier creature tokens. Generated from one table row.

import { CAPTAIN_OF_THE_WATCH } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { EventBody } from '../../types/events';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(CAPTAIN_OF_THE_WATCH, "Vigilance (Attacking doesn't cause this creature to tap.)\nOther Soldier creatures you control get +1/+1 and have vigilance.\nWhen this creature enters, create three 1/1 white Soldier creature tokens.");
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const TOKEN = tokenRef("Soldier|1/1|W|Creature|");
const EXTRA_TEXT = PRINTED.split('\n')[2] as string;

export const CAPTAIN_OF_THE_WATCH_SCRIPT: CardScript = {
  oracleId: CAPTAIN_OF_THE_WATCH.oracleId,
  name: CAPTAIN_OF_THE_WATCH.name,
  triggers: [
    {
      abilityId: 'etb',
      text: EXTRA_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Captain of the Watch - create three 1/1 white Soldier creature tokens",
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        Array.from({ length: 3 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN.oracleId,
          printingId: TOKEN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
  statics: [
    {
      abilityId: 'anthem',
      text: TEXT,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (candidate === self) return false;
        if (!chars.typeLine.types.includes("Creature")) return false;
        if (!chars.typeLine.subtypes.includes("Soldier")) return false;
        return true;
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'grant',
      text: TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (candidate === self) return false;
        if (!chars.typeLine.types.includes("Creature")) return false;
        if (!chars.typeLine.subtypes.includes("Soldier")) return false;
        return true;
      },
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};
