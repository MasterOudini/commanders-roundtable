// `Lay Bare` — counter the spell and look at its controller's hand: the
// look is a reveal to the CASTER alone (looking is not choosing —
// Gitaxian Probe's rule). D222.

import { LAY_BARE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LAY_BARE, "Counter target spell. Look at its controller's hand.");

export const LAY_BARE_SCRIPT: CardScript = {
  oracleId: LAY_BARE.oracleId,
  name: LAY_BARE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card) {
        const vc = ctx.state.cards[spell.card];
        if (vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      }
      const hand = ctx.state.zones.hand[spell.controller] ?? [];
      if (hand.length > 0) out.push({ t: 'CardsRevealed', cards: hand, to: [obj.controller] });
      return out;
    },
  },
};
