// `Thief of Hope` - a castSpiritOrArcane trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THIEF_OF_HOPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THIEF_OF_HOPE, "Whenever you cast a Spirit or Arcane spell, target opponent loses 1 life and you gain 1 life.\nSoulshift 2 (When this creature dies, you may return target Spirit card with mana value 2 or less from your graveyard to your hand.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target opponent loses 1 life and you gain 1 life.", THIEF_OF_HOPE.name);
const VOCAB_T_L0 = vocabularyTargets("Target opponent loses 1 life and you gain 1 life.");

export const THIEF_OF_HOPE_SCRIPT: CardScript = {
  oracleId: THIEF_OF_HOPE.oracleId,
  name: THIEF_OF_HOPE.name,
  triggers: [
    {
      abilityId: 'castSpiritOrArcane-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Thief of Hope - Target opponent loses 1 life and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
