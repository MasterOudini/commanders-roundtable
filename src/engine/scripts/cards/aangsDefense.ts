// `Aang's Defense` — my BLOCKING creature gets +2/+2 until end of turn, then
// I draw. The combat role and the controller are the parser's and the
// validator's (D291 + the D290 controller recursion).

import { AANG_S_DEFENSE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(AANG_S_DEFENSE, 'Target blocking creature you control gets +2/+2 until end of turn.\nDraw a card.');

export const AANGS_DEFENSE_SCRIPT: CardScript = {
  oracleId: AANG_S_DEFENSE.oracleId,
  name: AANG_S_DEFENSE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card') {
        const card = ctx.state.cards[target.id];
        if (card && card.zone.kind === 'battlefield') {
          events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 });
        }
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
