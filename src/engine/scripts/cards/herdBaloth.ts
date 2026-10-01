// `Herd Baloth` - a countersPutOnSelf trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERD_BALOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HERD_BALOTH, "Whenever one or more +1/+1 counters are put on this creature, you may create a 4/4 green Beast creature token.");
const TOKEN_L0 = tokenRef("Beast|4/4|G|Creature|");

export const HERD_BALOTH_SCRIPT: CardScript = {
  oracleId: HERD_BALOTH.oracleId,
  name: HERD_BALOTH.name,
  triggers: [
    {
      abilityId: 'countersPutOnSelf-0',
      text: PRINTED,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Herd Baloth - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
