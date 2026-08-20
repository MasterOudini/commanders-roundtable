// `Donate` — "Target player gains control of target permanent you
// control." Probed: TWO confident specs (any player; a permanent whose
// controller is YOU). The ControlChanged event has carried control since
// M3; this is its first SpellDef producer. D209.

import { DONATE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DONATE, 'Target player gains control of target permanent you control.');

export const DONATE_SCRIPT: CardScript = {
  oracleId: DONATE.oracleId,
  name: DONATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = obj.targets[0];
      const permanent = obj.targets[1];
      if (!player || player.kind !== 'player') return [];
      if (!permanent || permanent.kind !== 'card') return [];
      if (ctx.state.players[player.id]?.hasLost) return [];
      const card = ctx.state.cards[permanent.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      if (card.controller === player.id) return [];
      return [{ t: 'ControlChanged', card: permanent.id, controller: player.id }];
    },
  },
};
