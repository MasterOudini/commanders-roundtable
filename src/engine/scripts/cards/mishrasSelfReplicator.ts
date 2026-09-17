// `Mishra's Self-Replicator` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MISHRA_S_SELF_REPLICATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MISHRA_S_SELF_REPLICATOR, "Whenever you cast a historic spell, you may pay {1}. If you do, create a token that's a copy of this creature. (Artifacts, legendaries, and Sagas are historic.)");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, create a token that's a copy of this creature.", MISHRA_S_SELF_REPLICATOR.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, create a token that's a copy of this creature.");

export const MISHRAS_SELF_REPLICATOR_SCRIPT: CardScript = {
  oracleId: MISHRA_S_SELF_REPLICATOR.oracleId,
  name: MISHRA_S_SELF_REPLICATOR.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).typeLine.types.includes('Artifact') || ctx.derive(ev.obj.card).typeLine.supertypes.includes('Legendary') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Saga')),
      label: () => "Mishra's Self-Replicator - You may pay {1}. If you do, create a token that's a copy of this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
