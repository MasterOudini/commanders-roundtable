// `Ghosts of the Damned` — "{T}: Target creature gets -1/-0 until end of
// turn." The tap-cost debuff — Ghost Warden's mirror, with the cleanup
// asserted from the other side. M6.4t, D176.

import { GHOSTS_OF_THE_DAMNED } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GHOSTS_OF_THE_DAMNED, '{T}: Target creature gets -1/-0 until end of turn.');

export const GHOSTS_OF_THE_DAMNED_SCRIPT: CardScript = {
  oracleId: GHOSTS_OF_THE_DAMNED.oracleId,
  name: GHOSTS_OF_THE_DAMNED.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GHOSTS_OF_THE_DAMNED.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: 0 }];
      },
    },
  ],
};
