// `Setessan Champion` - a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SETESSAN_CHAMPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SETESSAN_CHAMPION, "Constellation — Whenever an enchantment you control enters, put a +1/+1 counter on this creature and draw a card.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on this creature and draw a card.", SETESSAN_CHAMPION.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on this creature and draw a card.");

export const SETESSAN_CHAMPION_SCRIPT: CardScript = {
  oracleId: SETESSAN_CHAMPION.oracleId,
  name: SETESSAN_CHAMPION.name,
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => "Setessan Champion - Put a +1/+1 counter on this creature and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
