// `Psychic Barrier` — "Counter target creature spell. Its controller
// loses 1 life." Overwhelming Intellect's typed counter with
// Illumination's controller read. D236.

import { PSYCHIC_BARRIER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PSYCHIC_BARRIER, 'Counter target creature spell. Its controller loses 1 life.');

export const PSYCHIC_BARRIER_SCRIPT: CardScript = {
  oracleId: PSYCHIC_BARRIER.oracleId,
  name: PSYCHIC_BARRIER.name,
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
      const player = ctx.state.players[controller];
      if (player && !player.hasLost) {
        out.push({ t: 'LifeChanged', player: controller, delta: -1, to: player.life - 1 });
      }
      return out;
    },
  },
};
