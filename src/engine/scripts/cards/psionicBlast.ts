// `Psionic Blast` — "Psionic Blast deals 4 damage to any target and 2
// damage to you." The burn with its printed recoil. D235.

import { PSIONIC_BLAST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PSIONIC_BLAST, 'Psionic Blast deals 4 damage to any target and 2 damage to you.');

export const PSIONIC_BLAST_SCRIPT: CardScript = {
  oracleId: PSIONIC_BLAST.oracleId,
  name: PSIONIC_BLAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
        return [];
      }
      if (target.kind === 'player' && !ctx.state.players[target.id]) return [];
      if (target.kind !== 'card' && target.kind !== 'player') return [];
      const damages = [
        {
          source: self,
          target:
            target.kind === 'card'
              ? { kind: 'card' as const, id: target.id }
              : { kind: 'player' as const, id: target.id },
          amount: 4,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        },
      ];
      const caster = ctx.state.players[obj.controller];
      if (caster && !caster.hasLost) {
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: obj.controller },
          amount: 2,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
