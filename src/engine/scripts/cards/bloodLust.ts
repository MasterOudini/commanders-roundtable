// `Blood Lust` — "If target creature has toughness 5 or greater, it gets
// +4/-4 until end of turn. Otherwise, it gets +4/-X until end of turn,
// where X is its toughness minus 1." Both branches are the DERIVED
// toughness at resolution; the printed formula is followed literally.
// D200.

import { BLOOD_LUST } from '../../../data/fixtures/engineCards';
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
  BLOOD_LUST,
  'If target creature has toughness 5 or greater, it gets +4/-4 until end of turn. Otherwise, it gets +4/-X until end of turn, where X is its toughness minus 1.',
);

export const BLOOD_LUST_SCRIPT: CardScript = {
  oracleId: BLOOD_LUST.oracleId,
  name: BLOOD_LUST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const t = ctx.derive(target.id).toughness ?? 0;
      const drop = t >= 5 ? 4 : t - 1;
      return [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 4, toughness: -drop },
      ];
    },
  },
};
