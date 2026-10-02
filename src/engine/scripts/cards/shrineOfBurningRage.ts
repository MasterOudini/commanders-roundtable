// `Shrine of Burning Rage` - a upkeep trigger vocab, a castSpell trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHRINE_OF_BURNING_RAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHRINE_OF_BURNING_RAGE, "At the beginning of your upkeep and whenever you cast a red spell, put a charge counter on this artifact.\n{3}, {T}, Sacrifice this artifact: It deals damage equal to the number of charge counters on it to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a charge counter on this artifact.", SHRINE_OF_BURNING_RAGE.name);
const VOCAB_T_L0 = vocabularyTargets("Put a charge counter on this artifact.");
const VOCAB_A0 = vocabularyEffects("~ deals damage equal to the number of charge counters on it to any target.", SHRINE_OF_BURNING_RAGE.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to the number of charge counters on it to any target.");

export const SHRINE_OF_BURNING_RAGE_SCRIPT: CardScript = {
  oracleId: SHRINE_OF_BURNING_RAGE.oracleId,
  name: SHRINE_OF_BURNING_RAGE.name,
  activated: [
    {
      ref: `${SHRINE_OF_BURNING_RAGE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Shrine of Burning Rage - Put a charge counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'castSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('R'),
      label: () => "Shrine of Burning Rage - Put a charge counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
