// `Will-o'-the-Wisp` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WILL_O_THE_WISP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WILL_O_THE_WISP, "Flying (This creature can't be blocked except by creatures with flying or reach.)\n{B}: Regenerate this creature. (The next time this creature would be destroyed this turn, instead tap it, remove it from combat, and heal all damage on it.)");
const LINES = PRINTED.split('\n');

export const WILL_OTHE_WISP_SCRIPT: CardScript = {
  oracleId: WILL_O_THE_WISP.oracleId,
  name: WILL_O_THE_WISP.name,
  activated: [
    {
      ref: `${WILL_O_THE_WISP.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
