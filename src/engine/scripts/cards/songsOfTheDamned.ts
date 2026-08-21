// `Songs of the Damned` — "Add {B} for each creature card in your
// graveyard." The census ritual: graveyard cards typed off the ORACLE face
// (a dead card has no battlefield derivation). D249.

import { SONGS_OF_THE_DAMNED } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import { EMPTY_POOL } from '../../types/mana';
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

const TEXT = printed(SONGS_OF_THE_DAMNED, 'Add {B} for each creature card in your graveyard.');

export const SONGS_OF_THE_DAMNED_SCRIPT: CardScript = {
  oracleId: SONGS_OF_THE_DAMNED.oracleId,
  name: SONGS_OF_THE_DAMNED.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (!oc) continue;
        if (faceOf(oc, inst.faceIndex).typeLine.types.includes('Creature')) n += 1;
      }
      if (n <= 0) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, B: n }, source: self },
      ];
    },
  },
};
