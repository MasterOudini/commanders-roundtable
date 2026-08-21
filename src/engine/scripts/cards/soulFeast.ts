// `Soul Feast` — "Target player loses 4 life and you gain 4 life." The
// targeted drain. D249.

import { SOUL_FEAST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOUL_FEAST, 'Target player loses 4 life and you gain 4 life.');

export const SOUL_FEAST_SCRIPT: CardScript = {
  oracleId: SOUL_FEAST.oracleId,
  name: SOUL_FEAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const events: EventBody[] = [];
      const victim = ctx.state.players[target.id];
      if (victim && !victim.hasLost) {
        events.push({ t: 'LifeChanged', player: target.id, delta: -4, to: victim.life - 4 });
      }
      const caster = ctx.state.players[obj.controller];
      if (caster && !caster.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 4, to: caster.life + 4 });
      }
      return events;
    },
  },
};
