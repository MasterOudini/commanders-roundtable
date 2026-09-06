// `Heron-Blessed Geist` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERON_BLESSED_GEIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HERON_BLESSED_GEIST, "Flying\n{3}{W}, Exile this card from your graveyard: Create two 1/1 white Spirit creature tokens with flying. Activate only if you control an enchantment and only as a sorcery.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Spirit|1/1|W|Creature|flying");

export const HERON_BLESSED_GEIST_SCRIPT: CardScript = {
  oracleId: HERON_BLESSED_GEIST.oracleId,
  name: HERON_BLESSED_GEIST.name,
  activated: [
    {
      ref: `${HERON_BLESSED_GEIST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
