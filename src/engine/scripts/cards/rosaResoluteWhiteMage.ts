// `Rosa, Resolute White Mage` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROSA_RESOLUTE_WHITE_MAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROSA_RESOLUTE_WHITE_MAGE, "Reach (This creature can block creatures with flying.)\nAt the beginning of combat on your turn, put a +1/+1 counter on target creature you control. It gains lifelink until end of turn. (Damage dealt by the creature also causes you to gain that much life.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature you control. It gains lifelink until end of turn.", ROSA_RESOLUTE_WHITE_MAGE.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature you control. It gains lifelink until end of turn.");

export const ROSA_RESOLUTE_WHITE_MAGE_SCRIPT: CardScript = {
  oracleId: ROSA_RESOLUTE_WHITE_MAGE.oracleId,
  name: ROSA_RESOLUTE_WHITE_MAGE.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Rosa, Resolute White Mage - Put a +1/+1 counter on target creature you control. It gains lifelink until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
