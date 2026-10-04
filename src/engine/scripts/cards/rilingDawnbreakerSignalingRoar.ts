// `Riling Dawnbreaker // Signaling Roar` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RILING_DAWNBREAKER_SIGNALING_ROAR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(RILING_DAWNBREAKER_SIGNALING_ROAR, "Flying, vigilance\nAt the beginning of combat on your turn, another target creature you control gets +1/+0 until end of turn.\nCreate a 2/2 white Soldier creature token. (Then shuffle this card into its owner's library.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target creature you control gets +1/+0 until end of turn.", RILING_DAWNBREAKER_SIGNALING_ROAR.name);
const VOCAB_T_L1 = vocabularyTargets("Another target creature you control gets +1/+0 until end of turn.");

export const RILING_DAWNBREAKER_SIGNALING_ROAR_SCRIPT: CardScript = {
  oracleId: RILING_DAWNBREAKER_SIGNALING_ROAR.oracleId,
  name: RILING_DAWNBREAKER_SIGNALING_ROAR.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Riling Dawnbreaker // Signaling Roar - Another target creature you control gets +1/+0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
