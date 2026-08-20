// `Harmless Offering` — Donate one word over: the receiving player must
// be an OPPONENT. The control gift's second producer. D217.

import { HARMLESS_OFFERING } from '../../../data/fixtures/engineCards';
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
  HARMLESS_OFFERING,
  'Target opponent gains control of target permanent you control.',
);

export const HARMLESS_OFFERING_SCRIPT: CardScript = {
  oracleId: HARMLESS_OFFERING.oracleId,
  name: HARMLESS_OFFERING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = obj.targets[0];
      const permanent = obj.targets[1];
      if (!player || player.kind !== 'player') return [];
      if (!permanent || permanent.kind !== 'card') return [];
      if (player.id === obj.controller) return [];
      if (ctx.state.players[player.id]?.hasLost) return [];
      const card = ctx.state.cards[permanent.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      if (card.controller === player.id) return [];
      return [{ t: 'ControlChanged', card: permanent.id, controller: player.id }];
    },
  },
};
