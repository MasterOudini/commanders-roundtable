// `Whitewater Naiads` - a constellation trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHITEWATER_NAIADS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHITEWATER_NAIADS, "Constellation — Whenever this creature or another enchantment you control enters, target creature can't be blocked this turn.");

const VOCAB_L0 = vocabularyEffects("Target creature can't be blocked this turn.", WHITEWATER_NAIADS.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature can't be blocked this turn.");

export const WHITEWATER_NAIADS_SCRIPT: CardScript = {
  oracleId: WHITEWATER_NAIADS.oracleId,
  name: WHITEWATER_NAIADS.name,
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
      label: () => "Whitewater Naiads - Target creature can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
