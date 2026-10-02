// `War Dance` - a upkeep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAR_DANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAR_DANCE, "At the beginning of your upkeep, you may put a verse counter on this enchantment.\nSacrifice this enchantment: Target creature gets +X/+X until end of turn, where X is the number of verse counters on this enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a verse counter on this enchantment.", WAR_DANCE.name);
const VOCAB_T_L0 = vocabularyTargets("Put a verse counter on this enchantment.");
const VOCAB_A0 = vocabularyEffects("Target creature gets +X/+X until end of turn, where X is the number of verse counters on ~.", WAR_DANCE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature gets +X/+X until end of turn, where X is the number of verse counters on ~.");

export const WAR_DANCE_SCRIPT: CardScript = {
  oracleId: WAR_DANCE.oracleId,
  name: WAR_DANCE.name,
  activated: [
    {
      ref: `${WAR_DANCE.oracleId}#a0`,
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
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "War Dance - Put a verse counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
