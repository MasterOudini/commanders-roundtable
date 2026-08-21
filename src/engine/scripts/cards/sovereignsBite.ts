// `Sovereign's Bite` — "Target player loses 3 life and you gain 3 life."
// Soul Feast's drain at three. D250.

import { SOVEREIGN_S_BITE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOVEREIGN_S_BITE, 'Target player loses 3 life and you gain 3 life.');

export const SOVEREIGNS_BITE_SCRIPT: CardScript = {
  oracleId: SOVEREIGN_S_BITE.oracleId,
  name: SOVEREIGN_S_BITE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const events: EventBody[] = [];
      const victim = ctx.state.players[target.id];
      if (victim && !victim.hasLost) {
        events.push({ t: 'LifeChanged', player: target.id, delta: -3, to: victim.life - 3 });
      }
      const caster = ctx.state.players[obj.controller];
      if (caster && !caster.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: caster.life + 3 });
      }
      return events;
    },
  },
};
