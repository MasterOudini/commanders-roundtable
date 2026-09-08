// `Zombie Musher` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZOMBIE_MUSHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZOMBIE_MUSHER, "Snow landwalk (This creature can't be blocked as long as defending player controls a snow land.)\n{S}: Regenerate this creature. ({S} can be paid with one mana from a snow source.)");
const LINES = PRINTED.split('\n');

export const ZOMBIE_MUSHER_SCRIPT: CardScript = {
  oracleId: ZOMBIE_MUSHER.oracleId,
  name: ZOMBIE_MUSHER.name,
  activated: [
    {
      ref: `${ZOMBIE_MUSHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
