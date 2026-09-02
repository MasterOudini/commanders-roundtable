// `Double Negative` — counter up to two target spells; each one still on the
// stack is countered and its card goes to its owner's graveyard.

import { DOUBLE_NEGATIVE } from '../../../data/fixtures/engineCards';
import { moveFromStack } from '../../effects';
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

const TEXT = printed(DOUBLE_NEGATIVE, 'Counter up to two target spells.');

export const DOUBLE_NEGATIVE_SCRIPT: CardScript = {
  oracleId: DOUBLE_NEGATIVE.oracleId,
  name: DOUBLE_NEGATIVE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'stack') continue;
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') continue;
        events.push({ t: 'SpellCountered', stackId: spell.id });
        if (spell.card) {
          const vc = ctx.state.cards[spell.card];
          if (vc) events.push(moveFromStack(spell.card, 'graveyard', vc.owner));
        }
      }
      return events;
    },
  },
};
