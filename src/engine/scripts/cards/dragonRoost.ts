// `Dragon Roost` — "{5}{R}{R}: Create a 5/5 red Dragon creature token with
// flying." A repeatable mana-only token faucet on an enchantment — Ant
// Queen's shape at Dragon rates. M6.4p, D172.

import { DRAGON_ROOST } from '../../../data/fixtures/engineCards';
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
  DRAGON_ROOST,
  '{5}{R}{R}: Create a 5/5 red Dragon creature token with flying. ' +
    "(It can't be blocked except by creatures with flying or reach.)",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const DRAGON = tokenRef('Dragon|5/5|R|Creature|flying');

export const DRAGON_ROOST_SCRIPT: CardScript = {
  oracleId: DRAGON_ROOST.oracleId,
  name: DRAGON_ROOST.name,
  activated: [
    {
      ref: `${DRAGON_ROOST.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DRAGON.oracleId,
          printingId: DRAGON.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
