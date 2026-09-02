// `Wisecrack` — batch-mate `Wrack with Madness`'s self-damage, plus a rider:
// if that creature is ATTACKING, 2 more to its controller.
//
// ⚠️ The attacking test reads `ctx.state.combat.attackers` — the same combat
// structure D269's Warpath reads for blockers. Outside combat there is no
// `combat` at all, so the rider simply does not fire, which is the branch
// worth pinning. ⚠️ And the controller is read BEFORE the damage, because a
// creature that dies to its own power would otherwise take its controller
// with it out of the state (a resolve cannot see its own effects). D270.

import { WISECRACK } from '../../../data/fixtures/engineCards';
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
  WISECRACK,
  "Target creature deals damage equal to its power to itself. If that creature is attacking, Wisecrack deals 2 damage to that creature's controller.",
);

export const WISECRACK_SCRIPT: CardScript = {
  oracleId: WISECRACK.oracleId,
  name: WISECRACK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];

      const d = ctx.derive(target.id);
      const power = d.power ?? 0;
      const controller = card.controller;
      const attacking = (ctx.state.combat?.attackers ?? []).some((a) => a.card === target.id);

      const damages = [];
      if (power > 0) {
        damages.push({
          source: target.id,
          target: { kind: 'card' as const, id: target.id },
          amount: power,
          deathtouch: d.keywords.has('deathtouch'),
          lifelinkTo: d.keywords.has('lifelink') ? controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: (d.keywords.has('infect') || d.keywords.has('wither')
            ? 'wither'
            : 'normal') as 'wither' | 'normal',
        });
      }
      if (attacking) {
        const hit = ctx.state.players[controller];
        if (hit && !hit.hasLost) {
          damages.push({
            // ⚠️ THIS half is sourced from the SPELL, not the creature.
            source: self,
            target: { kind: 'player' as const, id: controller },
            amount: 2,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          });
        }
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
