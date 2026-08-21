// `Roiling Terrain` — "Destroy target land, then Roiling Terrain deals
// damage to that land's controller equal to the number of land cards in
// that player's graveyard." Melt Terrain's unconditional recoil with the
// census computed AFTER the destroy: the destroyed land itself counts
// exactly when it lands in that player's graveyard (owner = controller);
// an indestructible miss still pays the pre-existing count. D241.

import { ROILING_TERRAIN } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  ROILING_TERRAIN,
  "Destroy target land, then Roiling Terrain deals damage to that land's controller equal to the number of land cards in that player's graveyard.",
);

export const ROILING_TERRAIN_SCRIPT: CardScript = {
  oracleId: ROILING_TERRAIN.oracleId,
  name: ROILING_TERRAIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const destroyed = !ctx.derive(target.id).keywords.has('indestructible');
      let lands = 0;
      for (const id of ctx.state.zones.graveyard[controller] ?? []) {
        const inst = ctx.state.cards[id];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!inst || !oc) continue;
        if (faceOf(oc, inst.faceIndex ?? 0).typeLine.types.includes('Land')) lands++;
      }
      if (destroyed && card.owner === controller) lands++;
      const events: EventBody[] = [];
      if (destroyed) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      if (lands > 0) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: controller },
              amount: lands,
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
