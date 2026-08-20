// `Calamitous Cave-In` — "Calamitous Cave-In deals X damage to each
// creature and each planeswalker, where X is the number of Caves you
// control plus the number of Cave cards in your graveyard." Battlefield
// Caves by DERIVE, graveyard Cave cards by ORACLE face (a hidden-zone card
// derives nothing). D202.

import { CALAMITOUS_CAVE_IN } from '../../../data/fixtures/engineCards';
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
  CALAMITOUS_CAVE_IN,
  'Calamitous Cave-In deals X damage to each creature and each planeswalker, where X is the number of Caves you control plus the number of Cave cards in your graveyard.',
);

export const CALAMITOUS_CAVE_IN_SCRIPT: CardScript = {
  oracleId: CALAMITOUS_CAVE_IN.oracleId,
  name: CALAMITOUS_CAVE_IN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Cave')) x++;
      }
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
        if (!oc) continue;
        if (faceOf(oc, card?.faceIndex ?? 0).typeLine.subtypes.includes('Cave')) x++;
      }
      if (x <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature') && !d.typeLine.types.includes('Planeswalker'))
          continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
