// `Riddlesmith` - a castArtifactSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIDDLESMITH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIDDLESMITH, "Whenever you cast an artifact spell, you may draw a card. If you do, discard a card.");

const VOCAB_L0 = vocabularyEffects("Draw a card. If you do, discard a card.", RIDDLESMITH.name);
const VOCAB_T_L0 = vocabularyTargets("Draw a card. If you do, discard a card.");

export const RIDDLESMITH_SCRIPT: CardScript = {
  oracleId: RIDDLESMITH.oracleId,
  name: RIDDLESMITH.name,
  triggers: [
    {
      abilityId: 'castArtifactSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Riddlesmith - Draw a card. If you do, discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
