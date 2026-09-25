// `Loathsome Curator` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOATHSOME_CURATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOATHSOME_CURATOR, "Exploit (When this creature enters, you may sacrifice a creature.)\nMenace\nWhen this creature exploits a creature, destroy target creature you don't control with mana value 3 or less.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Destroy target creature you don't control with mana value 3 or less.", LOATHSOME_CURATOR.name);
const VOCAB_T_L2 = vocabularyTargets("Destroy target creature you don't control with mana value 3 or less.");

export const LOATHSOME_CURATOR_SCRIPT: CardScript = {
  oracleId: LOATHSOME_CURATOR.oracleId,
  name: LOATHSOME_CURATOR.name,
  triggers: [
    {
      abilityId: 'exploits-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Loathsome Curator - Destroy target creature you don't control with mana value 3 or less.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
