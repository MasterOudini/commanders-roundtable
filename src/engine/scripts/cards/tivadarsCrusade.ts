// `Tivadar's Crusade` — the subtype wipe (Breath Weapon's shape, D201, with
// the filter positive rather than negated). Per-object indestructible, as
// every sweep since D192's Damnation. D260.

import { TIVADAR_S_CRUSADE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(TIVADAR_S_CRUSADE, 'Destroy all Goblins.');

export const TIVADARS_CRUSADE_SCRIPT: CardScript = {
  oracleId: TIVADAR_S_CRUSADE.oracleId,
  name: TIVADAR_S_CRUSADE.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield'; player: string };
        to: { kind: 'graveyard'; player: string };
      }[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.subtypes.includes('Goblin')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: inst.controller },
          to: { kind: 'graveyard', player: inst.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
