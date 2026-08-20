// `Ghoul's Feast` — "Target creature gets +X/+0 until end of turn, where X
// is the number of creature cards in your graveyard." The census is typed
// off ORACLE faces. D215.

import { GHOUL_S_FEAST } from '../../../data/fixtures/engineCards';
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
  GHOUL_S_FEAST,
  'Target creature gets +X/+0 until end of turn, where X is the number of creature cards in your graveyard.',
);

export const GHOULS_FEAST_SCRIPT: CardScript = {
  oracleId: GHOUL_S_FEAST.oracleId,
  name: GHOUL_S_FEAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        if (faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Creature')) x++;
      }
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: 0 }];
    },
  },
};
