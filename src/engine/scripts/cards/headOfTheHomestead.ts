// `Head of the Homestead` — "When this creature enters, create two 1/1
// white Rabbit creature tokens." Guarded Heir's two-token entry on a NEW
// pin: the Rabbits get DISTINCT ids through D164's allocator. M6.4w, D179.

import { HEAD_OF_THE_HOMESTEAD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  HEAD_OF_THE_HOMESTEAD,
  'When this creature enters, create two 1/1 white Rabbit creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const RABBIT = tokenRef('Rabbit|1/1|W|Creature|');

export const HEAD_OF_THE_HOMESTEAD_SCRIPT: CardScript = {
  oracleId: HEAD_OF_THE_HOMESTEAD.oracleId,
  name: HEAD_OF_THE_HOMESTEAD.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Head of the Homestead — create two 1/1 Rabbits',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: RABBIT.oracleId,
          printingId: RABBIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
