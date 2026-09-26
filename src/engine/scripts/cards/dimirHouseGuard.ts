// `Dimir House Guard` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIMIR_HOUSE_GUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIMIR_HOUSE_GUARD, "Fear (This creature can't be blocked except by artifact creatures and/or black creatures.)\nSacrifice a creature: Regenerate this creature.\nTransmute {1}{B}{B} ({1}{B}{B}, Discard this card: Search your library for a card with the same mana value as this card, reveal it, put it into your hand, then shuffle. Transmute only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const DIMIR_HOUSE_GUARD_SCRIPT: CardScript = {
  oracleId: DIMIR_HOUSE_GUARD.oracleId,
  name: DIMIR_HOUSE_GUARD.name,
  activated: [
    {
      ref: `${DIMIR_HOUSE_GUARD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
