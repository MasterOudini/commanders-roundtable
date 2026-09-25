// `Qarsi Sadist` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QARSI_SADIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QARSI_SADIST, "Exploit (When this creature enters, you may sacrifice a creature.)\nWhen this creature exploits a creature, target opponent loses 2 life and you gain 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target opponent loses 2 life and you gain 2 life.", QARSI_SADIST.name);
const VOCAB_T_L1 = vocabularyTargets("Target opponent loses 2 life and you gain 2 life.");

export const QARSI_SADIST_SCRIPT: CardScript = {
  oracleId: QARSI_SADIST.oracleId,
  name: QARSI_SADIST.name,
  triggers: [
    {
      abilityId: 'exploits-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Qarsi Sadist - Target opponent loses 2 life and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
