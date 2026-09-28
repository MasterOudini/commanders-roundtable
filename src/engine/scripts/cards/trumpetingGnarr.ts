// `Trumpeting Gnarr` - a mutates trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRUMPETING_GNARR } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(TRUMPETING_GNARR, "Mutate {3}{G/U}{G/U} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nWhenever this creature mutates, create a 3/3 green Beast creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Beast|3/3|G|Creature|");

export const TRUMPETING_GNARR_SCRIPT: CardScript = {
  oracleId: TRUMPETING_GNARR.oracleId,
  name: TRUMPETING_GNARR.name,
  triggers: [
    {
      abilityId: 'mutates-1',
      text: LINES[1] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Trumpeting Gnarr - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
