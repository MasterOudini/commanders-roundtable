// `Glissa's Scorn` — "Destroy target artifact. Its controller loses 1
// life." The rider is tied to the OBJECT (Death's Caress precedent): an
// indestructible survivor's controller still pays. D216.

import { GLISSA_S_SCORN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GLISSA_S_SCORN, 'Destroy target artifact. Its controller loses 1 life.');

export const GLISSAS_SCORN_SCRIPT: CardScript = {
  oracleId: GLISSA_S_SCORN.oracleId,
  name: GLISSA_S_SCORN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const p = ctx.state.players[controller];
      if (p && !p.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: -1, to: p.life - 1 });
      }
      return events;
    },
  },
};
