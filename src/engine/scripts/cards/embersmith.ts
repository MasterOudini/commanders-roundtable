// `Embersmith` - a castArtifactSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMBERSMITH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMBERSMITH, "Whenever you cast an artifact spell, you may pay {1}. If you do, this creature deals 1 damage to any target.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, this creature deals 1 damage to any target.", EMBERSMITH.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, this creature deals 1 damage to any target.");

export const EMBERSMITH_SCRIPT: CardScript = {
  oracleId: EMBERSMITH.oracleId,
  name: EMBERSMITH.name,
  triggers: [
    {
      abilityId: 'castArtifactSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Embersmith - You may pay {1}. If you do, this creature deals 1 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
