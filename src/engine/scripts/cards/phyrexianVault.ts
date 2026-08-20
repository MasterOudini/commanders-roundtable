// `Phyrexian Vault` — "{2}, {T}, Sacrifice a creature: Draw a card." The
// creature chooser paying a draw on an artifact. D233.

import { PHYREXIAN_VAULT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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

const TEXT = printed(PHYREXIAN_VAULT, '{2}, {T}, Sacrifice a creature: Draw a card.');

export const PHYREXIAN_VAULT_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_VAULT.oracleId,
  name: PHYREXIAN_VAULT.name,
  activated: [
    {
      ref: `${PHYREXIAN_VAULT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
