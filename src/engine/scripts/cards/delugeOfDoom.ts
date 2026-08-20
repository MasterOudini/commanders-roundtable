// `Deluge of Doom` — "All creatures get -X/-X until end of turn, where X is
// the number of card types among cards in your graveyard." X is the count
// of DISTINCT card types across the caster's graveyard, read off the ORACLE
// faces (a graveyard card has no battlefield derivation). D207.

import { DELUGE_OF_DOOM } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  DELUGE_OF_DOOM,
  'All creatures get -X/-X until end of turn, where X is the number of card types among cards in your graveyard.',
);

export const DELUGE_OF_DOOM_SCRIPT: CardScript = {
  oracleId: DELUGE_OF_DOOM.oracleId,
  name: DELUGE_OF_DOOM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const types = new Set<string>();
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        for (const t of faceOf(oc, card.faceIndex ?? 0).typeLine.types) types.add(t);
      }
      const x = types.size;
      if (x <= 0) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -x, toughness: -x });
      }
      return events;
    },
  },
};
