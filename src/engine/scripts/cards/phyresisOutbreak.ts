// `Phyresis Outbreak` — "Each opponent gets a poison counter. Then each
// creature your opponents control gets -1/-1 until end of turn for each
// poison counter its controller has." The poison lands FIRST, so the
// debuff reads each controller's count INCLUDING the new one. D232.

import { PHYRESIS_OUTBREAK } from '../../../data/fixtures/engineCards';
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
  PHYRESIS_OUTBREAK,
  'Each opponent gets a poison counter. Then each creature your opponents control gets -1/-1 until end of turn for each poison counter its controller has.',
);

export const PHYRESIS_OUTBREAK_SCRIPT: CardScript = {
  oracleId: PHYRESIS_OUTBREAK.oracleId,
  name: PHYRESIS_OUTBREAK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const poisonAfter = new Map<string, number>();
      for (const seat of ctx.state.seating) {
        if (seat === obj.controller) continue;
        const p = ctx.state.players[seat];
        if (!p || p.hasLost) continue;
        const to = (p.poison ?? 0) + 1;
        poisonAfter.set(seat, to);
        events.push({ t: 'PoisonChanged', player: seat, delta: 1, to });
      }
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const n = poisonAfter.get(card.controller);
        if (!n) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -n, toughness: -n });
      }
      return events;
    },
  },
};
