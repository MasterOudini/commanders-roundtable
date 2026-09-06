// `Troll Ascetic` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TROLL_ASCETIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TROLL_ASCETIC, "Hexproof (This creature can't be the target of spells or abilities your opponents control.)\n{1}{G}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const TROLL_ASCETIC_SCRIPT: CardScript = {
  oracleId: TROLL_ASCETIC.oracleId,
  name: TROLL_ASCETIC.name,
  activated: [
    {
      ref: `${TROLL_ASCETIC.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
