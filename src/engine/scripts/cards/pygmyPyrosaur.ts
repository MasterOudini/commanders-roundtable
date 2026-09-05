// `Pygmy Pyrosaur` - a static cantBlock, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PYGMY_PYROSAUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PYGMY_PYROSAUR, "This creature can't block.\n{R}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const PYGMY_PYROSAUR_SCRIPT: CardScript = {
  oracleId: PYGMY_PYROSAUR.oracleId,
  name: PYGMY_PYROSAUR.name,
  activated: [
    {
      ref: `${PYGMY_PYROSAUR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
