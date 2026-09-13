// `Kiri-Onna` - a etb trigger vocab, a castSpiritOrArcane trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIRI_ONNA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KIRI_ONNA, "When this creature enters, return target creature to its owner's hand.\nWhenever you cast a Spirit or Arcane spell, you may return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return target creature to its owner's hand.", KIRI_ONNA.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature to its owner's hand.");
const VOCAB_L1 = vocabularyEffects("Return this creature to its owner's hand.", KIRI_ONNA.name);
const VOCAB_T_L1 = vocabularyTargets("Return this creature to its owner's hand.");

export const KIRI_ONNA_SCRIPT: CardScript = {
  oracleId: KIRI_ONNA.oracleId,
  name: KIRI_ONNA.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Kiri-Onna - Return target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'castSpiritOrArcane-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Kiri-Onna - Return this creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
