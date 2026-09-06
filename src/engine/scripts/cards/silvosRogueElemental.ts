// `Silvos, Rogue Elemental` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILVOS_ROGUE_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILVOS_ROGUE_ELEMENTAL, "Trample\n{G}: Regenerate Silvos.");
const LINES = PRINTED.split('\n');

export const SILVOS_ROGUE_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: SILVOS_ROGUE_ELEMENTAL.oracleId,
  name: SILVOS_ROGUE_ELEMENTAL.name,
  activated: [
    {
      ref: `${SILVOS_ROGUE_ELEMENTAL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
