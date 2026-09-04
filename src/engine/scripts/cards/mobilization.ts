// `Mobilization` - a layer-6 grant: "Soldier creatures have vigilance". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Plus its second line: create a 1/1 white Soldier creature token. Generated from one table row.

import { MOBILIZATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOBILIZATION, "Soldier creatures have vigilance.\n{2}{W}: Create a 1/1 white Soldier creature token.");
const TEXT = PRINTED.split('\n')[0] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const TOKEN = tokenRef("Soldier|1/1|W|Creature|");
const EXTRA_TEXT = PRINTED.split('\n')[1] as string;

export const MOBILIZATION_SCRIPT: CardScript = {
  oracleId: MOBILIZATION.oracleId,
  name: MOBILIZATION.name,
  activated: [
    {
      ref: `${MOBILIZATION.oracleId}#a0`,
      text: EXTRA_TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        Array.from({ length: 1 }, () => ({
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
      abilityId: 'grant',
      text: TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
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
