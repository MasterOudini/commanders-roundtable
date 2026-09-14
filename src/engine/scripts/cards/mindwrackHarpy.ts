// `Mindwrack Harpy` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MINDWRACK_HARPY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MINDWRACK_HARPY, "Flying\nAt the beginning of combat on your turn, each player mills three cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each player mills three cards.", MINDWRACK_HARPY.name);
const VOCAB_T_L1 = vocabularyTargets("Each player mills three cards.");

export const MINDWRACK_HARPY_SCRIPT: CardScript = {
  oracleId: MINDWRACK_HARPY.oracleId,
  name: MINDWRACK_HARPY.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Mindwrack Harpy - Each player mills three cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
