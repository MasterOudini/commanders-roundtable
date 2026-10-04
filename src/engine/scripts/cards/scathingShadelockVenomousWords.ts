// `Scathing Shadelock // Venomous Words` - a firstMainPhase trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCATHING_SHADELOCK_VENOMOUS_WORDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCATHING_SHADELOCK_VENOMOUS_WORDS, "At the beginning of your first main phase, this creature becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\nTarget creature you control gets +2/+0 and gains deathtouch until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ becomes prepared.", SCATHING_SHADELOCK_VENOMOUS_WORDS.name);
const VOCAB_T_L0 = vocabularyTargets("~ becomes prepared.");

export const SCATHING_SHADELOCK_VENOMOUS_WORDS_SCRIPT: CardScript = {
  oracleId: SCATHING_SHADELOCK_VENOMOUS_WORDS.oracleId,
  name: SCATHING_SHADELOCK_VENOMOUS_WORDS.name,
  triggers: [
    {
      abilityId: 'firstMainPhase-0', face: 0,
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'precombatMain' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Scathing Shadelock // Venomous Words - ~ becomes prepared.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
