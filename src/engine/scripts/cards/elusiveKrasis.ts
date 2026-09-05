// `Elusive Krasis` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELUSIVE_KRASIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELUSIVE_KRASIS, "This creature can't be blocked.\nEvolve (Whenever a creature you control enters, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.)");
const LINES = PRINTED.split('\n');

export const ELUSIVE_KRASIS_SCRIPT: CardScript = {
  oracleId: ELUSIVE_KRASIS.oracleId,
  name: ELUSIVE_KRASIS.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
