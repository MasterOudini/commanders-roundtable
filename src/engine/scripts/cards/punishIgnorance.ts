// `Punish Ignorance` — "Counter target spell. Its controller loses 3
// life and you gain 3 life." The counter with both riders (Illumination
// and Ionize's family, four colours wide). D236.

import { PUNISH_IGNORANCE } from '../../../data/fixtures/engineCards';
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
  PUNISH_IGNORANCE,
  'Counter target spell. Its controller loses 3 life and you gain 3 life.',
);

export const PUNISH_IGNORANCE_SCRIPT: CardScript = {
  oracleId: PUNISH_IGNORANCE.oracleId,
  name: PUNISH_IGNORANCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const controller = spell.controller;
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card) {
        const vc = ctx.state.cards[spell.card];
        if (vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      }
      const loser = ctx.state.players[controller];
      if (loser && !loser.hasLost) {
        out.push({ t: 'LifeChanged', player: controller, delta: -3, to: loser.life - 3 });
      }
      const caster = ctx.state.players[obj.controller];
      if (caster && !caster.hasLost) {
        out.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: caster.life + 3 });
      }
      return out;
    },
  },
};
