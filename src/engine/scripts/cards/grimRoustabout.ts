// `Grim Roustabout` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRIM_ROUSTABOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRIM_ROUSTABOUT, "Unleash (You may have this creature enter with a +1/+1 counter on it. It can't block as long as it has a +1/+1 counter on it.)\n{1}{B}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const GRIM_ROUSTABOUT_SCRIPT: CardScript = {
  oracleId: GRIM_ROUSTABOUT.oracleId,
  name: GRIM_ROUSTABOUT.name,
  activated: [
    {
      ref: `${GRIM_ROUSTABOUT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
