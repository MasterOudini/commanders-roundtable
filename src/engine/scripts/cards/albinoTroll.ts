// `Albino Troll` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALBINO_TROLL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALBINO_TROLL, "Echo {1}{G} (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)\n{1}{G}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const ALBINO_TROLL_SCRIPT: CardScript = {
  oracleId: ALBINO_TROLL.oracleId,
  name: ALBINO_TROLL.name,
  activated: [
    {
      ref: `${ALBINO_TROLL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
