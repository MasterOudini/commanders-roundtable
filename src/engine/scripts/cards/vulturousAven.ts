// `Vulturous Aven` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VULTUROUS_AVEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VULTUROUS_AVEN, "Flying\nExploit (When this creature enters, you may sacrifice a creature.)\nWhen this creature exploits a creature, you draw two cards and you lose 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You draw two cards and you lose 2 life.", VULTUROUS_AVEN.name);
const VOCAB_T_L2 = vocabularyTargets("You draw two cards and you lose 2 life.");

export const VULTUROUS_AVEN_SCRIPT: CardScript = {
  oracleId: VULTUROUS_AVEN.oracleId,
  name: VULTUROUS_AVEN.name,
  triggers: [
    {
      abilityId: 'exploits-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Vulturous Aven - You draw two cards and you lose 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
