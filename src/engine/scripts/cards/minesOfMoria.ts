// `Mines of Moria` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MINES_OF_MORIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MINES_OF_MORIA, "Mines of Moria enters tapped unless you control a legendary creature.\n{T}: Add {R}.\n{3}{R}, {T}, Exile three cards from your graveyard: Create two Treasure tokens.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Treasure|/||Artifact|");

export const MINES_OF_MORIA_SCRIPT: CardScript = {
  oracleId: MINES_OF_MORIA.oracleId,
  name: MINES_OF_MORIA.name,
  activated: [
    {
      ref: `${MINES_OF_MORIA.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_1.oracleId,
          printingId: TOKEN_1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
