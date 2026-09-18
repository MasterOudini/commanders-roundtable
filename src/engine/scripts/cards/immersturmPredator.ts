// `Immersturm Predator` - a becomesTapped trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMMERSTURM_PREDATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IMMERSTURM_PREDATOR, "Flying\nWhenever this creature becomes tapped, exile up to one target card from a graveyard and put a +1/+1 counter on this creature.\nSacrifice another creature: This creature gains indestructible until end of turn. Tap it.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile up to one target card from a graveyard and put a +1/+1 counter on ~.", IMMERSTURM_PREDATOR.name);
const VOCAB_T_L1 = vocabularyTargets("Exile up to one target card from a graveyard and put a +1/+1 counter on ~.");
const VOCAB_A0 = vocabularyEffects("~ gains indestructible until end of turn. Tap it.", IMMERSTURM_PREDATOR.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains indestructible until end of turn. Tap it.");

export const IMMERSTURM_PREDATOR_SCRIPT: CardScript = {
  oracleId: IMMERSTURM_PREDATOR.oracleId,
  name: IMMERSTURM_PREDATOR.name,
  activated: [
    {
      ref: `${IMMERSTURM_PREDATOR.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'becomesTapped-1',
      text: LINES[1] as string,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Immersturm Predator - Exile up to one target card from a graveyard and put a +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
