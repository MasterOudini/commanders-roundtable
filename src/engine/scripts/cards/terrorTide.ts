// `Terror Tide` — the graveyard PERMANENT-CARD census as a board-wide -X/-X.
// The ability word rides on the printed line and the def claims it whole
// (Swirling Sandstorm's precedent, D256). The count is read off the ORACLE
// face — a graveyard card has no battlefield derivation (D171). D258.

import { TERROR_TIDE } from '../../../data/fixtures/engineCards';
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
  TERROR_TIDE,
  'Fathomless descent — All creatures get -X/-X until end of turn, where X is the number of permanent cards in your graveyard.',
);

const PERMANENT = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'];

export const TERROR_TIDE_SCRIPT: CardScript = {
  oracleId: TERROR_TIDE.oracleId,
  name: TERROR_TIDE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (!oc) continue;
        const types = faceOf(oc, inst.faceIndex ?? 0).typeLine.types;
        if (types.some((k) => PERMANENT.includes(k))) x += 1;
      }
      if (x === 0) return [];
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
