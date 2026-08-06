// `Ephara's Warden` — "{T}: Tap target creature with power 3 or less."
// Aysen Bureaucrats' numeric restriction on the aim (D139/D163), the tap
// with the turned-target guard. M6.4q, D173.

import { EPHARA_S_WARDEN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(EPHARA_S_WARDEN, '{T}: Tap target creature with power 3 or less.');

export const EPHARAS_WARDEN_SCRIPT: CardScript = {
  oracleId: EPHARA_S_WARDEN.oracleId,
  name: EPHARA_S_WARDEN.name,
  activated: [
    {
      ref: `${EPHARA_S_WARDEN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
