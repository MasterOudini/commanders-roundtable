// `Heap Gate` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEAP_GATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HEAP_GATE, "{T}: Add {C}.\n{1}, {T}: Add one mana of any color.\n{1}, {T}, Tap an untapped Gate you control: Create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");
const LINES = PRINTED.split('\n');
const TOKEN_2 = tokenRef("Treasure|/||Artifact|");

export const HEAP_GATE_SCRIPT: CardScript = {
  oracleId: HEAP_GATE.oracleId,
  name: HEAP_GATE.name,
  activated: [
    {
      ref: `${HEAP_GATE.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_2.oracleId,
          printingId: TOKEN_2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
