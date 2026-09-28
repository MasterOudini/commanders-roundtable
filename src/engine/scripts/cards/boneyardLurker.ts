// `Boneyard Lurker` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BONEYARD_LURKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BONEYARD_LURKER, "Mutate {2}{B/G}{B/G} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nWhenever this creature mutates, return target permanent card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target permanent card from your graveyard to your hand.", BONEYARD_LURKER.name);
const VOCAB_T_L1 = vocabularyTargets("Return target permanent card from your graveyard to your hand.");

export const BONEYARD_LURKER_SCRIPT: CardScript = {
  oracleId: BONEYARD_LURKER.oracleId,
  name: BONEYARD_LURKER.name,
  triggers: [
    {
      abilityId: 'mutates-1',
      text: LINES[1] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Boneyard Lurker - Return target permanent card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
