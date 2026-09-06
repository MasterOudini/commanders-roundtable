// `Hit-Monkey` - a static cantBeCountered
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIT_MONKEY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIT_MONKEY, "This spell can't be countered.\nReach, vigilance, deathtouch, hexproof, haste");
const LINES = PRINTED.split('\n');

export const HIT_MONKEY_SCRIPT: CardScript = {
  oracleId: HIT_MONKEY.oracleId,
  name: HIT_MONKEY.name,
  cantBeCountered: { abilityId: 'cant-be-countered-0', text: LINES[0] as string },
};
