// `Sedgemoor Witch` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEDGEMOOR_WITCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEDGEMOOR_WITCH, "Menace\nWard—Pay 3 life. (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays 3 life.)\nMagecraft — Whenever you cast or copy an instant or sorcery spell, create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"", SEDGEMOOR_WITCH.name);
const VOCAB_T_L2 = vocabularyTargets("Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"");

export const SEDGEMOOR_WITCH_SCRIPT: CardScript = {
  oracleId: SEDGEMOOR_WITCH.oracleId,
  name: SEDGEMOOR_WITCH.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Sedgemoor Witch - Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
