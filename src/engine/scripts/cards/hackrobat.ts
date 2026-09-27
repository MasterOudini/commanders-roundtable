// `Hackrobat` - an activation pumping itself, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HACKROBAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HACKROBAT, "Spectacle {B}{R} (You may cast this spell for its spectacle cost rather than its mana cost if an opponent lost life this turn.)\n{B}: This creature gains deathtouch until end of turn.\n{R}: This creature gets +2/-2 until end of turn.");
const LINES = PRINTED.split('\n');

export const HACKROBAT_SCRIPT: CardScript = {
  oracleId: HACKROBAT.oracleId,
  name: HACKROBAT.name,
  activated: [
    {
      ref: `${HACKROBAT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
    {
      ref: `${HACKROBAT.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: -2 }];
      },
    },
  ],
};
