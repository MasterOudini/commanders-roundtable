// `Renegade Silent` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RENEGADE_SILENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RENEGADE_SILENT, "At the beginning of your end step, goad up to one target creature you don't control and put a +1/+1 counter on this creature. This creature phases out. (Treat it and anything attached to it as though they don't exist until your next turn.)");

const VOCAB_L0 = vocabularyEffects("Goad up to one target creature you don't control and put a +1/+1 counter on this creature. ~ phases out.", RENEGADE_SILENT.name);
const VOCAB_T_L0 = vocabularyTargets("Goad up to one target creature you don't control and put a +1/+1 counter on this creature. ~ phases out.");

export const RENEGADE_SILENT_SCRIPT: CardScript = {
  oracleId: RENEGADE_SILENT.oracleId,
  name: RENEGADE_SILENT.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Renegade Silent - Goad up to one target creature you don't control and put a +1/+1 counter on this creature. ~ phases out.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
