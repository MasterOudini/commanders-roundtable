// `Undermine` — the counter-with-rider family (Illumination and Ionize,
// D219): counter the spell and bill ITS CONTROLLER 3 life.
//
// ⚠️ The controller is read off the stack object BEFORE the counter — once
// the spell is countered the object is gone.
// ⚠️ `SpellCountered` alone strands the card in the stack zone (D170's Daring
// Apprentice), so the move goes through `moveFromStack`. D263.

import { UNDERMINE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(UNDERMINE, 'Counter target spell. Its controller loses 3 life.');

export const UNDERMINE_SCRIPT: CardScript = {
  oracleId: UNDERMINE.oracleId,
  name: UNDERMINE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];

      const vc = spell.card ? ctx.state.cards[spell.card] : null;
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card && vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));

      const p = ctx.state.players[spell.controller];
      if (p && !p.hasLost) {
        out.push({ t: 'LifeChanged', player: spell.controller, delta: -3, to: p.life - 3 });
      }
      return out;
    },
  },
};
