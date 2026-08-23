// `Unlicensed Disintegration` — destroy, plus 3 to the victim's CONTROLLER
// only if I control an artifact.
//
// ⚠️ The controller is read BEFORE the destruction, off the pre-resolution
// board — after the move the card's `controller` is reset to its OWNER
// (D120's `clearBattlefieldFields`), which would be the wrong player for a
// stolen creature. D264.

import { UNLICENSED_DISINTEGRATION } from '../../../data/fixtures/engineCards';
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
  UNLICENSED_DISINTEGRATION,
  "Destroy target creature. If you control an artifact, Unlicensed Disintegration deals 3 damage to that creature's controller.",
);

export const UNLICENSED_DISINTEGRATION_SCRIPT: CardScript = {
  oracleId: UNLICENSED_DISINTEGRATION.oracleId,
  name: UNLICENSED_DISINTEGRATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const victimController = card.controller;

      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: victimController },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }

      let artifact = false;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Artifact')) {
          artifact = true;
          break;
        }
      }
      const hit = ctx.state.players[victimController];
      if (artifact && hit && !hit.hasLost) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: victimController },
              amount: 3,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }
      return events;
    },
  },
};
