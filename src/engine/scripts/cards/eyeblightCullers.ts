// `Eyeblight Cullers` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EYEBLIGHT_CULLERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EYEBLIGHT_CULLERS, "When this creature dies, create three 1/1 green Elf Warrior creature tokens, then mill three cards. (Put the top three cards of your library into your graveyard.)");

const VOCAB_L0 = vocabularyEffects("Create three 1/1 green Elf Warrior creature tokens, then mill three cards.", EYEBLIGHT_CULLERS.name);
const VOCAB_T_L0 = vocabularyTargets("Create three 1/1 green Elf Warrior creature tokens, then mill three cards.");

export const EYEBLIGHT_CULLERS_SCRIPT: CardScript = {
  oracleId: EYEBLIGHT_CULLERS.oracleId,
  name: EYEBLIGHT_CULLERS.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Eyeblight Cullers - Create three 1/1 green Elf Warrior creature tokens, then mill three cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
