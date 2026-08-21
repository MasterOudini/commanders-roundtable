// `Saltfield Recluse` — "{T}: Target creature gets -2/-0 until end of
// turn." The tap-debuff active. D243.

import { SALTFIELD_RECLUSE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SALTFIELD_RECLUSE, '{T}: Target creature gets -2/-0 until end of turn.');

export const SALTFIELD_RECLUSE_SCRIPT: CardScript = {
  oracleId: SALTFIELD_RECLUSE.oracleId,
  name: SALTFIELD_RECLUSE.name,
  activated: [
    {
      ref: `${SALTFIELD_RECLUSE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 }];
      },
    },
  ],
};
