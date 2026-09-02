// `Witch Hunter` — the tap pings a player or planeswalker for 1; three mana
// and the tap bounce an opponent's creature.

import { WITCH_HUNTER } from '../../../data/fixtures/engineCards';
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
  WITCH_HUNTER,
  "{T}: This creature deals 1 damage to target player or planeswalker.\n{1}{W}{W}, {T}: Return target creature an opponent controls to its owner's hand.",
);
const PING = PRINTED.split('\n')[0] as string;
const BOUNCE = PRINTED.split('\n')[1] as string;

export const WITCH_HUNTER_SCRIPT: CardScript = {
  oracleId: WITCH_HUNTER.oracleId,
  name: WITCH_HUNTER.name,
  activated: [
    {
      ref: `${WITCH_HUNTER.oracleId}#a0`,
      text: PING,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        if (target.kind === 'player') {
          const them = ctx.state.players[target.id];
          if (!them || them.hasLost) return [];
        }
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
    {
      ref: `${WITCH_HUNTER.oracleId}#a1`,
      text: BOUNCE,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
