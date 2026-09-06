// `River Boa` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIVER_BOA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIVER_BOA, "Islandwalk (This creature can't be blocked as long as defending player controls an Island.)\n{G}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const RIVER_BOA_SCRIPT: CardScript = {
  oracleId: RIVER_BOA.oracleId,
  name: RIVER_BOA.name,
  activated: [
    {
      ref: `${RIVER_BOA.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
