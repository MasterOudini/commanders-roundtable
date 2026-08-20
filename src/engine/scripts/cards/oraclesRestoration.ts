// `Oracle's Restoration` — "Target creature you control gets +1/+1 until
// end of turn. You draw a card and gain 1 life." Three riders in one
// resolve. D230.

import { ORACLE_S_RESTORATION } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  ORACLE_S_RESTORATION,
  'Target creature you control gets +1/+1 until end of turn. You draw a card and gain 1 life.',
);

export const ORACLES_RESTORATION_SCRIPT: CardScript = {
  oracleId: ORACLE_S_RESTORATION.oracleId,
  name: ORACLE_S_RESTORATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const player = ctx.state.players[obj.controller];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 },
      ];
      if (player && !player.hasLost) {
        events.push(...drawEvents(ctx.state, obj.controller, 1));
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 });
      }
      return events;
    },
  },
};
