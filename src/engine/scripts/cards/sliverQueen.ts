// `Sliver Queen` — "{2}: Create a 1/1 colorless Sliver creature token." The
// repeatable token legend on the NEW Sliver pin. D249.

import { SLIVER_QUEEN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SLIVER_QUEEN, '{2}: Create a 1/1 colorless Sliver creature token.');

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SLIVER = tokenRef('Sliver|1/1||Creature|');

export const SLIVER_QUEEN_SCRIPT: CardScript = {
  oracleId: SLIVER_QUEEN.oracleId,
  name: SLIVER_QUEEN.name,
  activated: [
    {
      ref: `${SLIVER_QUEEN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SLIVER.oracleId,
          printingId: SLIVER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
