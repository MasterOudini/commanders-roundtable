// `Straw Golem` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STRAW_GOLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STRAW_GOLEM, "When an opponent casts a creature spell, sacrifice this creature.");

const VOCAB_L0 = vocabularyEffects("Sacrifice this creature.", STRAW_GOLEM.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice this creature.");

export const STRAW_GOLEM_SCRIPT: CardScript = {
  oracleId: STRAW_GOLEM.oracleId,
  name: STRAW_GOLEM.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Straw Golem - Sacrifice this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
