// `Illumination` — counter the artifact-or-enchantment spell; its
// controller banks its mana value (chosen X included). D219.

import { ILLUMINATION } from '../../../data/fixtures/engineCards';
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
  ILLUMINATION,
  'Counter target artifact or enchantment spell. Its controller gains life equal to its mana value.',
);

export const ILLUMINATION_SCRIPT: CardScript = {
  oracleId: ILLUMINATION.oracleId,
  name: ILLUMINATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const vc = spell.card ? ctx.state.cards[spell.card] : null;
      const oc = vc && ctx.oracle.byPrinting(vc.printingId);
      const xCount = oc ? (faceOf(oc, vc.faceIndex ?? 0).manaCost?.xCount ?? 0) : 0;
      const mv = (oc?.manaValue ?? 0) + xCount * (spell.xValue ?? 0);
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card && vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      const p = ctx.state.players[spell.controller];
      if (mv > 0 && p && !p.hasLost) {
        out.push({ t: 'LifeChanged', player: spell.controller, delta: mv, to: p.life + mv });
      }
      return out;
    },
  },
};
