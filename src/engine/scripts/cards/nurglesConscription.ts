// `Nurgle's Conscription` — "Put target creature card from an opponent's
// graveyard onto the battlefield tapped under your control, then exile
// that player's graveyard." The opponent-graveyard reanimation with a
// tapped entry and the graveyard swept AFTER (the arriving creature has
// already left it). D229.

import { NURGLE_S_CONSCRIPTION } from '../../../data/fixtures/engineCards';
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
  NURGLE_S_CONSCRIPTION,
  "Put target creature card from an opponent's graveyard onto the battlefield tapped under your control, then exile that player's graveyard.",
);

export const NURGLES_CONSCRIPTION_SCRIPT: CardScript = {
  oracleId: NURGLE_S_CONSCRIPTION.oracleId,
  name: NURGLE_S_CONSCRIPTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'graveyard') return [];
      const graveOwner = card.zone.player;
      if (!graveOwner) return [];
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'graveyard', player: graveOwner },
              to: { kind: 'battlefield', player: obj.controller },
            },
          ],
        },
        { t: 'PermanentsTapped', cards: [target.id] },
      ];
      const rest = (ctx.state.zones.graveyard[graveOwner] ?? []).filter(
        (id) => id !== target.id,
      );
      if (rest.length > 0) {
        events.push({
          t: 'CardsMoved',
          moves: rest.map((id) => ({
            card: id,
            from: { kind: 'graveyard' as const, player: graveOwner },
            to: { kind: 'exile' as const, player: ctx.state.cards[id]?.owner ?? graveOwner },
          })),
        });
      }
      return events;
    },
  },
};
