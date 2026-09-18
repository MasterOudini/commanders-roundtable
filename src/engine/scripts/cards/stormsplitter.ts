// `Stormsplitter` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORMSPLITTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STORMSPLITTER, "Haste\nWhenever you cast an instant or sorcery spell, create a token that's a copy of this creature. Exile that token at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a token that's a copy of this creature. Exile that token at the beginning of the next end step.", STORMSPLITTER.name);
const VOCAB_T_L1 = vocabularyTargets("Create a token that's a copy of this creature. Exile that token at the beginning of the next end step.");

export const STORMSPLITTER_SCRIPT: CardScript = {
  oracleId: STORMSPLITTER.oracleId,
  name: STORMSPLITTER.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Stormsplitter - Create a token that's a copy of this creature. Exile that token at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
