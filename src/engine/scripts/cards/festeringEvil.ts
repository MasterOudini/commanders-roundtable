// `Festering Evil` - a upkeep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FESTERING_EVIL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FESTERING_EVIL, "At the beginning of your upkeep, this enchantment deals 1 damage to each creature and each player.\n{B}{B}, Sacrifice this enchantment: It deals 3 damage to each creature and each player.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("This enchantment deals 1 damage to each creature and each player.", FESTERING_EVIL.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment deals 1 damage to each creature and each player.");
const VOCAB_A0 = vocabularyEffects("~ deals 3 damage to each creature and each player.", FESTERING_EVIL.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 3 damage to each creature and each player.");

export const FESTERING_EVIL_SCRIPT: CardScript = {
  oracleId: FESTERING_EVIL.oracleId,
  name: FESTERING_EVIL.name,
  activated: [
    {
      ref: `${FESTERING_EVIL.oracleId}#a0`,
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
      label: () => "Festering Evil - This enchantment deals 1 damage to each creature and each player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
