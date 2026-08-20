// `Heroes' Reunion` — target player gains 7. D217.

import { HEROES_REUNION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HEROES_REUNION, 'Target player gains 7 life.');

export const HEROES_REUNION_SCRIPT: CardScript = {
  oracleId: HEROES_REUNION.oracleId,
  name: HEROES_REUNION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      return [{ t: 'LifeChanged', player: target.id, delta: 7, to: p.life + 7 }];
    },
  },
};
