// `Howling Giant` — "When this creature enters, create two 2/2 green Wolf
// creature tokens." Head of the Homestead's pair one size up, on the Wolf
// pin the pool already holds. M6.4x, D180.

import { HOWLING_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  HOWLING_GIANT,
  'Reach (This creature can block creatures with flying.)\nWhen this creature enters, create two 2/2 green Wolf creature tokens.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const WOLF = tokenRef('Wolf|2/2|G|Creature|');

export const HOWLING_GIANT_SCRIPT: CardScript = {
  oracleId: HOWLING_GIANT.oracleId,
  name: HOWLING_GIANT.name,
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
      label: () => 'Howling Giant — create two 2/2 Wolves',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: WOLF.oracleId,
          printingId: WOLF.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
