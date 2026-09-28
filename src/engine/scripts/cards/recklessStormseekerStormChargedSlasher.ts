// `Reckless Stormseeker // Storm-Charged Slasher` - a combatOnYourTurn trigger vocab, a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RECKLESS_STORMSEEKER_STORM_CHARGED_SLASHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RECKLESS_STORMSEEKER_STORM_CHARGED_SLASHER, "At the beginning of combat on your turn, target creature you control gets +1/+0 and gains haste until end of turn.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\nAt the beginning of combat on your turn, target creature you control gets +2/+0 and gains trample and haste until end of turn.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target creature you control gets +1/+0 and gains haste until end of turn.", RECKLESS_STORMSEEKER_STORM_CHARGED_SLASHER.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature you control gets +1/+0 and gains haste until end of turn.");
const VOCAB_L2 = vocabularyEffects("Target creature you control gets +2/+0 and gains trample and haste until end of turn.", RECKLESS_STORMSEEKER_STORM_CHARGED_SLASHER.name);
const VOCAB_T_L2 = vocabularyTargets("Target creature you control gets +2/+0 and gains trample and haste until end of turn.");

export const RECKLESS_STORMSEEKER_STORM_CHARGED_SLASHER_SCRIPT: CardScript = {
  oracleId: RECKLESS_STORMSEEKER_STORM_CHARGED_SLASHER.oracleId,
  name: RECKLESS_STORMSEEKER_STORM_CHARGED_SLASHER.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0', face: 0,
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Reckless Stormseeker // Storm-Charged Slasher - Target creature you control gets +1/+0 and gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'combatOnYourTurn-2', face: 1,
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Reckless Stormseeker // Storm-Charged Slasher - Target creature you control gets +2/+0 and gains trample and haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
