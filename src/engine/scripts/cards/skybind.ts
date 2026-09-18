// `Skybind` - a constellation trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYBIND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYBIND, "Constellation — Whenever this enchantment or another enchantment you control enters, exile target nonenchantment permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

const VOCAB_L0 = vocabularyEffects("Exile target nonenchantment permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.", SKYBIND.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target nonenchantment permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

export const SKYBIND_SCRIPT: CardScript = {
  oracleId: SKYBIND.oracleId,
  name: SKYBIND.name,
  triggers: [
    {
      abilityId: 'constellation-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Enchantment')),
        ),
      label: () => "Skybind - Exile target nonenchantment permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
