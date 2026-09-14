// `Entomber Exarch` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ENTOMBER_EXARCH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(ENTOMBER_EXARCH, "When this creature enters, choose one —\n• Return target creature card from your graveyard to your hand.\n• Target opponent reveals their hand. You choose a noncreature card from it. That player discards that card.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Return target creature card from your graveyard to your hand.", targets: vocabularyTargets("Return target creature card from your graveyard to your hand.") },
  { text: "Target opponent reveals their hand. You choose a noncreature card from it. That player discards that card.", targets: vocabularyTargets("Target opponent reveals their hand. You choose a noncreature card from it. That player discards that card.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Return target creature card from your graveyard to your hand.", ENTOMBER_EXARCH.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Return target creature card from your graveyard to your hand.");
const VOCAB_L0_m1 = vocabularyEffects("Target opponent reveals their hand. You choose a noncreature card from it. That player discards that card.", ENTOMBER_EXARCH.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Target opponent reveals their hand. You choose a noncreature card from it. That player discards that card.");

export const ENTOMBER_EXARCH_SCRIPT: CardScript = {
  oracleId: ENTOMBER_EXARCH.oracleId,
  name: ENTOMBER_EXARCH.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Entomber Exarch - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L0_m0, VOCAB_T_L0_m0);
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
