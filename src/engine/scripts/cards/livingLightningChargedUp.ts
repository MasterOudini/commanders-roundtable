// `Living Lightning, Charged Up` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIVING_LIGHTNING_CHARGED_UP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIVING_LIGHTNING_CHARGED_UP, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nHaste (This creature can attack and {T} as soon as he comes under your control.)\nAt the beginning of combat on your turn, another target creature you control gets +1/+0 and gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Another target creature you control gets +1/+0 and gains haste until end of turn.", LIVING_LIGHTNING_CHARGED_UP.name);
const VOCAB_T_L2 = vocabularyTargets("Another target creature you control gets +1/+0 and gains haste until end of turn.");

export const LIVING_LIGHTNING_CHARGED_UP_SCRIPT: CardScript = {
  oracleId: LIVING_LIGHTNING_CHARGED_UP.oracleId,
  name: LIVING_LIGHTNING_CHARGED_UP.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Living Lightning, Charged Up - Another target creature you control gets +1/+0 and gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
