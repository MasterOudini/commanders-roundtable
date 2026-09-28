// `Cloudpiercer` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLOUDPIERCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLOUDPIERCER, "Mutate {3}{R} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nReach\nWhenever this creature mutates, you may discard a card. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You may discard a card. If you do, draw a card.", CLOUDPIERCER.name);
const VOCAB_T_L2 = vocabularyTargets("You may discard a card. If you do, draw a card.");

export const CLOUDPIERCER_SCRIPT: CardScript = {
  oracleId: CLOUDPIERCER.oracleId,
  name: CLOUDPIERCER.name,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: LINES[2] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Cloudpiercer - You may discard a card. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
