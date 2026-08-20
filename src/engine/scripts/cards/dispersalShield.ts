// `Dispersal Shield` — "Counter target spell if its mana value is less than
// or equal to the greatest mana value among permanents you control."
// Corrupted Resolve's conditional counter with a board-computed bound. The
// spell's MV counts a chosen X (CR 616.1/202.3b): the printed mana value
// plus xValue per {X} in the printed cost. D208.

import { DISPERSAL_SHIELD } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  DISPERSAL_SHIELD,
  'Counter target spell if its mana value is less than or equal to the greatest mana value among permanents you control.',
);

export const DISPERSAL_SHIELD_SCRIPT: CardScript = {
  oracleId: DISPERSAL_SHIELD.oracleId,
  name: DISPERSAL_SHIELD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const vc = spell.card ? ctx.state.cards[spell.card] : null;
      const oc = vc && ctx.oracle.byPrinting(vc.printingId);
      if (!oc) return [];
      const xCount = faceOf(oc, vc.faceIndex ?? 0).manaCost?.xCount ?? 0;
      const spellMv = (oc.manaValue ?? 0) + xCount * (spell.xValue ?? 0);
      let greatest = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > greatest) greatest = mv;
      }
      if (spellMv > greatest) return [];
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card && vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      return out;
    },
  },
};
