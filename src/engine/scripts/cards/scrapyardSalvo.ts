// `Scrapyard Salvo` — "deals damage to target player or planeswalker
// equal to the number of artifact cards in your graveyard." The
// oracle-typed graveyard census burn. D244.

import { SCRAPYARD_SALVO } from '../../../data/fixtures/engineCards';
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
  SCRAPYARD_SALVO,
  'Scrapyard Salvo deals damage to target player or planeswalker equal to the number of artifact cards in your graveyard.',
);

export const SCRAPYARD_SALVO_SCRIPT: CardScript = {
  oracleId: SCRAPYARD_SALVO.oracleId,
  name: SCRAPYARD_SALVO.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      let artifacts = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
        if (!card || !oc) continue;
        if (faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Artifact')) artifacts++;
      }
      if (artifacts <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount: artifacts,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
    },
  },
};
