// `Living Wall` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIVING_WALL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIVING_WALL, "Defender (This creature can't attack.)\n{1}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const LIVING_WALL_SCRIPT: CardScript = {
  oracleId: LIVING_WALL.oracleId,
  name: LIVING_WALL.name,
  activated: [
    {
      ref: `${LIVING_WALL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
