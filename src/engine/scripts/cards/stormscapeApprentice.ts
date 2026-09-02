// `Stormscape Apprentice` — "{W}, {T}: Tap target creature.\n{B}, {T}:
// Target player loses 1 life." Naya Battlemage's tap (D278) and Jund
// Battlemage's drain (D277) on one Wizard — the guildmage tap carrier with
// effects the generator's table does not hold. Hand-written. D281.

import { STORMSCAPE_APPRENTICE } from '../../../data/fixtures/engineCards';
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
  STORMSCAPE_APPRENTICE,
  '{W}, {T}: Tap target creature.\n{B}, {T}: Target player loses 1 life.',
);
const TAP = PRINTED.split('\n')[0] as string;
const DRAIN = PRINTED.split('\n')[1] as string;

export const STORMSCAPE_APPRENTICE_SCRIPT: CardScript = {
  oracleId: STORMSCAPE_APPRENTICE.oracleId,
  name: STORMSCAPE_APPRENTICE.name,
  activated: [
    {
      ref: `${STORMSCAPE_APPRENTICE.oracleId}#a0`,
      text: TAP,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
    {
      ref: `${STORMSCAPE_APPRENTICE.oracleId}#a1`,
      text: DRAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: them.life - 1 }];
      },
    },
  ],
};
