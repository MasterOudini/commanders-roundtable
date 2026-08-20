// `Peppersmoke` — "Target creature gets -1/-1 until end of turn. If you
// control a Faerie, draw a card." The board-query rider (Misthios's
// shape) on a debuff. D232.

import { PEPPERSMOKE } from '../../../data/fixtures/engineCards';
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
  PEPPERSMOKE,
  'Target creature gets -1/-1 until end of turn. If you control a Faerie, draw a card.',
);

export const PEPPERSMOKE_SCRIPT: CardScript = {
  oracleId: PEPPERSMOKE.oracleId,
  name: PEPPERSMOKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 },
      ];
      const hasFaerie = ctx.state.zones.battlefield.some((id) => {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) return false;
        return ctx.derive(id).typeLine.subtypes.includes('Faerie');
      });
      const player = ctx.state.players[obj.controller];
      if (hasFaerie && player && !player.hasLost) {
        events.push(...drawEvents(ctx.state, obj.controller, 1));
      }
      return events;
    },
  },
};
