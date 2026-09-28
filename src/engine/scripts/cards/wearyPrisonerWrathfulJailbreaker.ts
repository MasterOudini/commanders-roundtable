// `Weary Prisoner // Wrathful Jailbreaker` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WEARY_PRISONER_WRATHFUL_JAILBREAKER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(WEARY_PRISONER_WRATHFUL_JAILBREAKER, "Defender\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\nThis creature attacks each combat if able.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

export const WEARY_PRISONER_WRATHFUL_JAILBREAKER_SCRIPT: CardScript = {
  oracleId: WEARY_PRISONER_WRATHFUL_JAILBREAKER.oracleId,
  name: WEARY_PRISONER_WRATHFUL_JAILBREAKER.name,
  combat: [
    {
      abilityId: 'mustAttack-2', face: 1,
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
