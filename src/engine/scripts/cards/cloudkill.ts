// `Cloudkill` — "All creatures get -X/-X until end of turn, where X is the
// greatest mana value of a commander you own on the battlefield or in the
// command zone." The commander read spans both zones (Slash the Ranks'
// commanderIds, D192). D203.

import { CLOUDKILL } from '../../../data/fixtures/engineCards';
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
  CLOUDKILL,
  'All creatures get -X/-X until end of turn, where X is the greatest mana value of a commander you own on the battlefield or in the command zone.',
);

export const CLOUDKILL_SCRIPT: CardScript = {
  oracleId: CLOUDKILL.oracleId,
  name: CLOUDKILL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.players[obj.controller]?.commanderIds ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (card.zone.kind !== 'battlefield' && card.zone.kind !== 'command') continue;
        if (card.owner !== obj.controller) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > x) x = mv;
      }
      if (x <= 0) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -x, toughness: -x });
      }
      return events;
    },
  },
};
