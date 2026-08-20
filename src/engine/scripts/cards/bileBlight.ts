// `Bile Blight` — "Target creature and all other creatures with the same
// name as that creature get -3/-3 until end of turn." The NAME comes from
// the oracle (Accumulated Knowledge's predicate on the battlefield): the
// target's entry plus one per same-name creature, tokens included — two
// Grizzly Bears die together. D199.

import { BILE_BLIGHT } from '../../../data/fixtures/engineCards';
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
  BILE_BLIGHT,
  'Target creature and all other creatures with the same name as that creature get -3/-3 until end of turn.',
);

export const BILE_BLIGHT_SCRIPT: CardScript = {
  oracleId: BILE_BLIGHT.oracleId,
  name: BILE_BLIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const name = ctx.oracle.byPrinting(card.printingId)?.name;
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -3, toughness: -3 },
      ];
      if (name !== undefined) {
        for (const id of ctx.state.zones.battlefield) {
          if (id === target.id) continue;
          const other = ctx.state.cards[id];
          if (!other) continue;
          if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
          if (ctx.oracle.byPrinting(other.printingId)?.name !== name) continue;
          events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -3, toughness: -3 });
        }
      }
      return events;
    },
  },
};
