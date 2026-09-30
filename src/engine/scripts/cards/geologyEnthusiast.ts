// `Geology Enthusiast` - a endStep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GEOLOGY_ENTHUSIAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GEOLOGY_ENTHUSIAST, "At the beginning of your end step, create a tapped Powerstone token. (It's an artifact with \"{T}: Add {C}. This mana can't be spent to cast a nonartifact spell.\")\n{6}: Draw a card and put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a tapped Powerstone token.", GEOLOGY_ENTHUSIAST.name);
const VOCAB_T_L0 = vocabularyTargets("Create a tapped Powerstone token.");
const VOCAB_A0 = vocabularyEffects("Draw a card and put a +1/+1 counter on ~.", GEOLOGY_ENTHUSIAST.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card and put a +1/+1 counter on ~.");

export const GEOLOGY_ENTHUSIAST_SCRIPT: CardScript = {
  oracleId: GEOLOGY_ENTHUSIAST.oracleId,
  name: GEOLOGY_ENTHUSIAST.name,
  activated: [
    {
      ref: `${GEOLOGY_ENTHUSIAST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'endStep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Geology Enthusiast - Create a tapped Powerstone token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
