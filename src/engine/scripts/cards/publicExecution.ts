// `Public Execution` — "Destroy target creature an opponent controls.
// Each other creature that player controls gets -2/-0 until end of
// turn." The controller is read BEFORE the move; the victim is exempt
// from its own aftermath. D236.

import { PUBLIC_EXECUTION } from '../../../data/fixtures/engineCards';
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
  PUBLIC_EXECUTION,
  'Destroy target creature an opponent controls. Each other creature that player controls gets -2/-0 until end of turn.',
);

export const PUBLIC_EXECUTION_SCRIPT: CardScript = {
  oracleId: PUBLIC_EXECUTION.oracleId,
  name: PUBLIC_EXECUTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const victimController = card.controller;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
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
      for (const id of ctx.state.zones.battlefield) {
        if (id === target.id) continue;
        const other = ctx.state.cards[id];
        if (!other || other.controller !== victimController) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -2, toughness: 0 });
      }
      return events;
    },
  },
};
