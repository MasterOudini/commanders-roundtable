// `Naya Battlemage` — "{R}, {T}: Target creature gets +2/+0 until end of
// turn.\n{W}, {T}: Tap target creature." The guildmage tap carrier with a
// pump the generator's table could hold and a TAP it could not (Akroan
// Jailer's PermanentsTapped, skipped for a creature already tapped).
// Hand-written. D278.

import { NAYA_BATTLEMAGE } from '../../../data/fixtures/engineCards';
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
  NAYA_BATTLEMAGE,
  '{R}, {T}: Target creature gets +2/+0 until end of turn.\n{W}, {T}: Tap target creature.',
);
const PUMP = PRINTED.split('\n')[0] as string;
const TAP = PRINTED.split('\n')[1] as string;

export const NAYA_BATTLEMAGE_SCRIPT: CardScript = {
  oracleId: NAYA_BATTLEMAGE.oracleId,
  name: NAYA_BATTLEMAGE.name,
  activated: [
    {
      ref: `${NAYA_BATTLEMAGE.oracleId}#a0`,
      text: PUMP,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0, keywords: [] }];
      },
    },
    {
      ref: `${NAYA_BATTLEMAGE.oracleId}#a1`,
      text: TAP,
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
