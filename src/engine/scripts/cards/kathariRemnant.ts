// `Kathari Remnant` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KATHARI_REMNANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KATHARI_REMNANT, "Flying\n{B}: Regenerate this creature.\nCascade (When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost. Put the exiled cards on the bottom in a random order.)");
const LINES = PRINTED.split('\n');

export const KATHARI_REMNANT_SCRIPT: CardScript = {
  oracleId: KATHARI_REMNANT.oracleId,
  name: KATHARI_REMNANT.name,
  activated: [
    {
      ref: `${KATHARI_REMNANT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
