// `Thunderscape Apprentice` — {B} and the tap drain a player for 1; {G} and
// the tap give a creature +1/+1.

import { THUNDERSCAPE_APPRENTICE } from '../../../data/fixtures/engineCards';
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
  THUNDERSCAPE_APPRENTICE,
  '{B}, {T}: Target player loses 1 life.\n{G}, {T}: Target creature gets +1/+1 until end of turn.',
);
const DRAIN = PRINTED.split('\n')[0] as string;
const PUMP = PRINTED.split('\n')[1] as string;

export const THUNDERSCAPE_APPRENTICE_SCRIPT: CardScript = {
  oracleId: THUNDERSCAPE_APPRENTICE.oracleId,
  name: THUNDERSCAPE_APPRENTICE.name,
  activated: [
    {
      ref: `${THUNDERSCAPE_APPRENTICE.oracleId}#a0`,
      text: DRAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: them.life - 1 }];
      },
    },
    {
      ref: `${THUNDERSCAPE_APPRENTICE.oracleId}#a1`,
      text: PUMP,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1, keywords: [] }];
      },
    },
  ],
};
