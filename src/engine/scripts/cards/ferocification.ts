// `Ferocification` - a combatOnYourTurn trigger vocab, a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FEROCIFICATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FEROCIFICATION, "At the beginning of combat on your turn, choose one —\n• Target creature you control gets +2/+0 until end of turn.\n• Target creature you control gains menace and haste until end of turn.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Target creature you control gets +2/+0 until end of turn.", targets: vocabularyTargets("Target creature you control gets +2/+0 until end of turn.") },
  { text: "Target creature you control gains menace and haste until end of turn.", targets: vocabularyTargets("Target creature you control gains menace and haste until end of turn.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Target creature you control gets +2/+0 until end of turn.", FEROCIFICATION.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Target creature you control gets +2/+0 until end of turn.");
const VOCAB_L0_m1 = vocabularyEffects("Target creature you control gains menace and haste until end of turn.", FEROCIFICATION.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Target creature you control gains menace and haste until end of turn.");

export const FEROCIFICATION_SCRIPT: CardScript = {
  oracleId: FEROCIFICATION.oracleId,
  name: FEROCIFICATION.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Ferocification - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
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
