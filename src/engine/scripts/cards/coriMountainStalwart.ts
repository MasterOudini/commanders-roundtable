// `Cori Mountain Stalwart` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORI_MOUNTAIN_STALWART } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORI_MOUNTAIN_STALWART, "Flurry — Whenever you cast your second spell each turn, this creature deals 2 damage to each opponent and you gain 2 life.");

const VOCAB_L0 = vocabularyEffects("~ deals 2 damage to each opponent and you gain 2 life.", CORI_MOUNTAIN_STALWART.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 2 damage to each opponent and you gain 2 life.");

export const CORI_MOUNTAIN_STALWART_SCRIPT: CardScript = {
  oracleId: CORI_MOUNTAIN_STALWART.oracleId,
  name: CORI_MOUNTAIN_STALWART.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Cori Mountain Stalwart - ~ deals 2 damage to each opponent and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
