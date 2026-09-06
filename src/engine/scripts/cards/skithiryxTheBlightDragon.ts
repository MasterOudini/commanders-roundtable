// `Skithiryx, the Blight Dragon` - an activation pumping itself, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKITHIRYX_THE_BLIGHT_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKITHIRYX_THE_BLIGHT_DRAGON, "Flying\nInfect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\n{B}: Skithiryx gains haste until end of turn.\n{B}{B}: Regenerate Skithiryx.");
const LINES = PRINTED.split('\n');

export const SKITHIRYX_THE_BLIGHT_DRAGON_SCRIPT: CardScript = {
  oracleId: SKITHIRYX_THE_BLIGHT_DRAGON.oracleId,
  name: SKITHIRYX_THE_BLIGHT_DRAGON.name,
  activated: [
    {
      ref: `${SKITHIRYX_THE_BLIGHT_DRAGON.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["haste"] }];
      },
    },
    {
      ref: `${SKITHIRYX_THE_BLIGHT_DRAGON.oracleId}#a1`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
