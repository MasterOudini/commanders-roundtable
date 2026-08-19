// `Char` — "Char deals 4 damage to any target and 2 damage to you." The
// FIRST targeted SpellDef, and the seam's assisted-offer proof: the
// vocabulary reads this sentence only in part, so without the suppression in
// `client.assistedEffectsFor` the parsed half would be offered AGAIN after
// this def already ran the whole card. One DamageDealt with both entries —
// "deals X and Y" is one dealing. D187.

import { CHAR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CHAR, 'Char deals 4 damage to any target and 2 damage to you.');

export const CHAR_SCRIPT: CardScript = {
  oracleId: CHAR.oracleId,
  name: CHAR.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      const caster = ctx.state.players[obj.controller];
      // The spell is still on the stack (CR 608.2), so `self` is a live
      // source for both damage entries. A spell has no derived keywords —
      // deathtouch/lifelink/infect live on permanents — so the entries are
      // plain, with the per-kind applyAs left 'normal'.
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount: 4,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
            ...(caster && !caster.hasLost
              ? [
                  {
                    source: self,
                    target: { kind: 'player' as const, id: obj.controller },
                    amount: 2,
                    deathtouch: false,
                    lifelinkTo: null,
                    isCommanderDamage: false,
                    viaTrample: 0,
                    toxic: 0,
                    applyAs: 'normal' as const,
                  },
                ]
              : []),
          ],
        },
      ];
    },
  },
};
