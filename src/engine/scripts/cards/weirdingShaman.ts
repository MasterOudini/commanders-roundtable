// `Weirding Shaman` — "{3}{B}, Sacrifice a Goblin: Create two 1/1 black
// Goblin Rogue creature tokens." A subtype sacrifice (Arms Dealer's shape)
// paying TWO tokens with DISTINCT ids through D164's allocator.
//
// ⚠️ "Sacrifice a Goblin" is not "another", and the Shaman IS a Goblin — so
// it may eat itself and still make the pair. D268.

import { WEIRDING_SHAMAN } from '../../../data/fixtures/engineCards';
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
  WEIRDING_SHAMAN,
  '{3}{B}, Sacrifice a Goblin: Create two 1/1 black Goblin Rogue creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GOBLIN_ROGUE = tokenRef('Goblin Rogue|1/1|B|Creature|');

export const WEIRDING_SHAMAN_SCRIPT: CardScript = {
  oracleId: WEIRDING_SHAMAN.oracleId,
  name: WEIRDING_SHAMAN.name,
  activated: [
    {
      ref: `${WEIRDING_SHAMAN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GOBLIN_ROGUE.oracleId,
          printingId: GOBLIN_ROGUE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
