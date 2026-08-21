// `Take Heart` — the pump plus a gain censused off MY declared attackers
// (Keep Watch's read, one side over). D256.

import { TAKE_HEART } from '../../../data/fixtures/engineCards';
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
  TAKE_HEART,
  'Target creature gets +2/+2 until end of turn. You gain 1 life for each attacking creature you control.',
);

export const TAKE_HEART_SCRIPT: CardScript = {
  oracleId: TAKE_HEART.oracleId,
  name: TAKE_HEART.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 },
      ];
      let attackers = 0;
      for (const a of ctx.state.combat?.attackers ?? []) {
        const card = ctx.state.cards[a.card];
        if (card?.controller === obj.controller) attackers += 1;
      }
      if (attackers > 0) {
        const player = ctx.state.players[obj.controller];
        if (player && !player.hasLost) {
          events.push({
            t: 'LifeChanged',
            player: obj.controller,
            delta: attackers,
            to: player.life + attackers,
          });
        }
      }
      return events;
    },
  },
};
