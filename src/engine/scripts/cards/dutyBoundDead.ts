// `Duty-Bound Dead` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUTY_BOUND_DEAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUTY_BOUND_DEAD, "Exalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\n{3}{B}: Regenerate this creature. (The next time this creature would be destroyed this turn, instead tap it, remove it from combat, and heal all damage on it.)");
const LINES = PRINTED.split('\n');

export const DUTY_BOUND_DEAD_SCRIPT: CardScript = {
  oracleId: DUTY_BOUND_DEAD.oracleId,
  name: DUTY_BOUND_DEAD.name,
  activated: [
    {
      ref: `${DUTY_BOUND_DEAD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
