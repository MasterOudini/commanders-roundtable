// `Gruul Guildmage` — "({R/G} can be paid with either {R} or {G}.)\n{3}{R},
// Sacrifice a land: This creature deals 2 damage to target player or
// planeswalker.\n{3}{G}: Target creature gets +2/+2 until end of turn." The
// reminder line is a hybrid-mana note the engine already honours (Noxious
// Revival's shape, D229); the land-sacrifice chooser is Aura Fracture's
// (D169) paying for a Chandra's Fury compound target (D203) with the
// Guildmage itself as the damage source (Arms Dealer's derived source,
// deathtouch and lifelink read off it); the pump is the family's. D275.

import { GRUUL_GUILDMAGE } from '../../../data/fixtures/engineCards';
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
  GRUUL_GUILDMAGE,
  '({R/G} can be paid with either {R} or {G}.)\n{3}{R}, Sacrifice a land: This creature deals 2 damage to target player or planeswalker.\n{3}{G}: Target creature gets +2/+2 until end of turn.',
);
const BOLT = PRINTED.split('\n')[1] as string;
const PUMP = PRINTED.split('\n')[2] as string;

export const GRUUL_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: GRUUL_GUILDMAGE.oracleId,
  name: GRUUL_GUILDMAGE.name,
  activated: [
    {
      ref: `${GRUUL_GUILDMAGE.oracleId}#a0`,
      text: BOLT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        if (target.kind === 'player') {
          const them = ctx.state.players[target.id];
          if (!them || them.hasLost) return [];
        }
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 2,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
    {
      ref: `${GRUUL_GUILDMAGE.oracleId}#a1`,
      text: PUMP,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] }];
      },
    },
  ],
};
