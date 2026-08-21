// `Renowned Weaver` — "{1}{G}, Sacrifice this creature: Create a 1/3
// green Spider enchantment creature token with reach." The self-sac
// paying an enchantment-creature token. D239.

import { RENOWNED_WEAVER } from '../../../data/fixtures/engineCards';
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
  RENOWNED_WEAVER,
  '{1}{G}, Sacrifice this creature: Create a 1/3 green Spider enchantment creature token with reach. ' +
    '(It can block creatures with flying.)',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIDER = tokenRef('Spider|1/3|G|Creature Enchantment|reach');

export const RENOWNED_WEAVER_SCRIPT: CardScript = {
  oracleId: RENOWNED_WEAVER.oracleId,
  name: RENOWNED_WEAVER.name,
  activated: [
    {
      ref: `${RENOWNED_WEAVER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIDER.oracleId,
          printingId: SPIDER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
