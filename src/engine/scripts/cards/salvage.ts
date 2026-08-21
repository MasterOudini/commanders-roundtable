// `Salvage` — "Put target card from your graveyard on top of your
// library." Noxious Revival's placement-top return, own-graveyard —
// zones AND controller enforced (probed). D243.

import { SALVAGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SALVAGE, 'Put target card from your graveyard on top of your library.');

export const SALVAGE_SCRIPT: CardScript = {
  oracleId: SALVAGE.oracleId,
  name: SALVAGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'graveyard') return [];
      const graveOwner = card.zone.player;
      if (!graveOwner) return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'graveyard', player: graveOwner },
              to: { kind: 'library', player: card.owner },
              placement: 'top',
            },
          ],
        },
      ];
    },
  },
};
