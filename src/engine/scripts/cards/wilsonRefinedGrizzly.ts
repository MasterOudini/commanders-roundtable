// `Wilson, Refined Grizzly` - a static cantBeCountered
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WILSON_REFINED_GRIZZLY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WILSON_REFINED_GRIZZLY, "This spell can't be countered.\nVigilance, reach, trample\nWard {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nChoose a Background (You can have a Background as a second commander.)");
const LINES = PRINTED.split('\n');

export const WILSON_REFINED_GRIZZLY_SCRIPT: CardScript = {
  oracleId: WILSON_REFINED_GRIZZLY.oracleId,
  name: WILSON_REFINED_GRIZZLY.name,
  cantBeCountered: { abilityId: 'cant-be-countered-0', text: LINES[0] as string },
};
