// `Rot-Tide Gargantua` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROT_TIDE_GARGANTUA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(ROT_TIDE_GARGANTUA, "Exploit (When this creature enters, you may sacrifice a creature.)\nWhen this creature exploits a creature, each opponent sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent sacrifices a creature of their choice.", ROT_TIDE_GARGANTUA.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent sacrifices a creature of their choice.");

export const ROT_TIDE_GARGANTUA_SCRIPT: CardScript = {
  oracleId: ROT_TIDE_GARGANTUA.oracleId,
  name: ROT_TIDE_GARGANTUA.name,
  triggers: [
    {
      abilityId: 'exploits-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Rot-Tide Gargantua - Each opponent sacrifices a creature of their choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
