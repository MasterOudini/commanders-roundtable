// `Goblin Trenches` — "{2}, Sacrifice a land: Create two 1/1 red and white
// Goblin Soldier creature tokens." The D168 LAND-predicate chooser paying
// for a two-token resolve with distinct ids (D164). M6.4u, D177.

import { GOBLIN_TRENCHES } from '../../../data/fixtures/engineCards';
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
  GOBLIN_TRENCHES,
  '{2}, Sacrifice a land: Create two 1/1 red and white Goblin Soldier creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GOBLIN_SOLDIER = tokenRef('Goblin Soldier|1/1|RW|Creature|');

export const GOBLIN_TRENCHES_SCRIPT: CardScript = {
  oracleId: GOBLIN_TRENCHES.oracleId,
  name: GOBLIN_TRENCHES.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GOBLIN_TRENCHES.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GOBLIN_SOLDIER.oracleId,
          printingId: GOBLIN_SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
