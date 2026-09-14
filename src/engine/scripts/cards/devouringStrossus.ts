// `Devouring Strossus` - a upkeep trigger vocab, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEVOURING_STROSSUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEVOURING_STROSSUS, "Flying, trample\nAt the beginning of your upkeep, sacrifice a creature.\nSacrifice a creature: Regenerate this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice a creature.", DEVOURING_STROSSUS.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice a creature.");

export const DEVOURING_STROSSUS_SCRIPT: CardScript = {
  oracleId: DEVOURING_STROSSUS.oracleId,
  name: DEVOURING_STROSSUS.name,
  activated: [
    {
      ref: `${DEVOURING_STROSSUS.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Devouring Strossus - Sacrifice a creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
