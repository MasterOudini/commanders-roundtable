// `Thought-Knot Seer` - a etb trigger vocab, a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THOUGHT_KNOT_SEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THOUGHT_KNOT_SEER, "({C} represents colorless mana.)\nWhen this creature enters, target opponent reveals their hand. You choose a nonland card from it and exile that card.\nWhen this creature leaves the battlefield, target opponent draws a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target opponent reveals their hand. You choose a nonland card from it and exile that card.", THOUGHT_KNOT_SEER.name);
const VOCAB_T_L1 = vocabularyTargets("Target opponent reveals their hand. You choose a nonland card from it and exile that card.");
const VOCAB_L2 = vocabularyEffects("Target opponent draws a card.", THOUGHT_KNOT_SEER.name);
const VOCAB_T_L2 = vocabularyTargets("Target opponent draws a card.");

export const THOUGHT_KNOT_SEER_SCRIPT: CardScript = {
  oracleId: THOUGHT_KNOT_SEER.oracleId,
  name: THOUGHT_KNOT_SEER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Thought-Knot Seer - Target opponent reveals their hand. You choose a nonland card from it and exile that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'leavesBattlefield-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Thought-Knot Seer - Target opponent draws a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
