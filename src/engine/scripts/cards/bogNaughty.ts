// `Bog Naughty` — "Flying\n{2}{B}, Sacrifice a Food: Target creature gets
// -3/-3 until end of turn." The chooser's Food predicate (a SUBTYPE that
// mostly lives on tokens) driving a debuff the SBA turns lethal — the layer
// 7c event, with the kill left to the rules. The keyword line has no colon,
// so the ability is index 0. M6.4l, D169.

import { BOG_NAUGHTY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  BOG_NAUGHTY,
  'Flying\n{2}{B}, Sacrifice a Food: Target creature gets -3/-3 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BOG_NAUGHTY_SCRIPT: CardScript = {
  oracleId: BOG_NAUGHTY.oracleId,
  name: BOG_NAUGHTY.name,
  activated: [
    {
      ref: `${BOG_NAUGHTY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -3, toughness: -3 }];
      },
    },
  ],
};
