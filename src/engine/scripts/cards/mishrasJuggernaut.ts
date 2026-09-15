// `Mishra's Juggernaut` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MISHRA_S_JUGGERNAUT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

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

const PRINTED = printed(MISHRA_S_JUGGERNAUT, "Trample\nThis creature attacks each combat if able.\nUnearth {5}{R} ({5}{R}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const MISHRAS_JUGGERNAUT_SCRIPT: CardScript = {
  oracleId: MISHRA_S_JUGGERNAUT.oracleId,
  name: MISHRA_S_JUGGERNAUT.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
