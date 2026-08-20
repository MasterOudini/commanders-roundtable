// `Corrupted Resolve` — "Counter target spell if its controller is
// poisoned." The condition reads the STACK object's controller's poison at
// resolution: not poisoned, the counter does nothing. D205.

import { CORRUPTED_RESOLVE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CORRUPTED_RESOLVE, 'Counter target spell if its controller is poisoned.');

export const CORRUPTED_RESOLVE_SCRIPT: CardScript = {
  oracleId: CORRUPTED_RESOLVE.oracleId,
  name: CORRUPTED_RESOLVE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const poison = ctx.state.players[spell.controller]?.poison ?? 0;
      if (poison <= 0) return [];
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card) {
        const vc = ctx.state.cards[spell.card];
        if (vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      }
      return out;
    },
  },
};
