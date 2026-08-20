// `Jaded Response` — counter only if the spell shares a color with a
// creature I control: the condition read at resolution off the CAST
// face's colors against my derived board. D220.

import { JADED_RESPONSE } from '../../../data/fixtures/engineCards';
import { moveFromStack } from '../../effects';
import { faceOf } from '../../oracle';
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
  JADED_RESPONSE,
  'Counter target spell if it shares a color with a creature you control.',
);

export const JADED_RESPONSE_SCRIPT: CardScript = {
  oracleId: JADED_RESPONSE.oracleId,
  name: JADED_RESPONSE.name,
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
      const spellColors = faceOf(oc, vc.faceIndex ?? 0).colors;
      let shares = false;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.colors.some((c) => spellColors.includes(c))) {
          shares = true;
          break;
        }
      }
      if (!shares) return [];
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card && vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      return out;
    },
  },
};
