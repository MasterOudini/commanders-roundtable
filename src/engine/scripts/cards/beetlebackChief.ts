// `Beetleback Chief` — "When this creature enters, create two 1/1 red Goblin
// creature tokens." The first MULTI-TOKEN resolve: two `TokenCreated` events,
// two fresh instance ids, one trigger. M6.4g, D164.

import { BEETLEBACK_CHIEF } from '../../../data/fixtures/engineCards';
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
  BEETLEBACK_CHIEF,
  'When this creature enters, create two 1/1 red Goblin creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GOBLIN = tokenRef('Goblin|1/1|R|Creature|');

export const BEETLEBACK_CHIEF_SCRIPT: CardScript = {
  oracleId: BEETLEBACK_CHIEF.oracleId,
  name: BEETLEBACK_CHIEF.name,
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
      label: () => 'Beetleback Chief — create two 1/1 Goblins',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: GOBLIN.oracleId,
          printingId: GOBLIN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
