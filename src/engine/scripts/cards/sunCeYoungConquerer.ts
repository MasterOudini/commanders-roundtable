// `Sun Ce, Young Conquerer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUN_CE_YOUNG_CONQUERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUN_CE_YOUNG_CONQUERER, "Horsemanship (This creature can't be blocked except by creatures with horsemanship.)\nWhen Sun Ce enters, you may return target creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature to its owner's hand.", SUN_CE_YOUNG_CONQUERER.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature to its owner's hand.");

export const SUN_CE_YOUNG_CONQUERER_SCRIPT: CardScript = {
  oracleId: SUN_CE_YOUNG_CONQUERER.oracleId,
  name: SUN_CE_YOUNG_CONQUERER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sun Ce, Young Conquerer - Return target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
