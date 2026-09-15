// `Soldevi Simulacrum` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOLDEVI_SIMULACRUM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOLDEVI_SIMULACRUM, "Cumulative upkeep {1} (At the beginning of your upkeep, put an age counter on this permanent, then sacrifice it unless you pay its upkeep cost for each age counter on it.)\n{1}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const SOLDEVI_SIMULACRUM_SCRIPT: CardScript = {
  oracleId: SOLDEVI_SIMULACRUM.oracleId,
  name: SOLDEVI_SIMULACRUM.name,
  activated: [
    {
      ref: `${SOLDEVI_SIMULACRUM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
