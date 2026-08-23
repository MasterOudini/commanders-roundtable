// `Unified Will` — the conditional counter (Corrupted Resolve's shape, D205)
// on a TWO-SIDED census: my creature count against the spell controller's.
// Strictly MORE, so a tie is a true no-op and the spell resolves. D264.

import { UNIFIED_WILL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  UNIFIED_WILL,
  "Counter target spell if you control more creatures than that spell's controller.",
);

export const UNIFIED_WILL_SCRIPT: CardScript = {
  oracleId: UNIFIED_WILL.oracleId,
  name: UNIFIED_WILL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];

      const count = (player: string): number => {
        let n = 0;
        for (const id of ctx.state.zones.battlefield) {
          const inst = ctx.state.cards[id];
          if (!inst || inst.controller !== player) continue;
          if (ctx.derive(id).typeLine.types.includes('Creature')) n += 1;
        }
        return n;
      };

      if (count(obj.controller) <= count(spell.controller)) return [];

      const vc = spell.card ? ctx.state.cards[spell.card] : null;
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card && vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      return out;
    },
  },
};
