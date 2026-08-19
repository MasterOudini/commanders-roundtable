// `Gitaxian Probe` — "Look at target player's hand.\nDraw a card." The
// first hand REVEAL in a def: `CardsRevealed` marks the target's whole
// hand `revealedTo` the caster and projection does the rest — the caster
// SEES it, everyone else still does not (`redactEvent` strips the ids).
// ⚠️ Looking is NOT choosing: D137's Duress-class refusal was about the
// caster PICKING from a revealed hand, which stays refused; this only
// shows it. The {U/P} Phyrexian cost has been payable since D164. D196.

import { GITAXIAN_PROBE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  GITAXIAN_PROBE,
  "({U/P} can be paid with either {U} or 2 life.)\nLook at target player's hand.\nDraw a card.",
);

export const GITAXIAN_PROBE_SCRIPT: CardScript = {
  oracleId: GITAXIAN_PROBE.oracleId,
  name: GITAXIAN_PROBE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const hand = ctx.state.zones.hand[target.id] ?? [];
      const events: EventBody[] = [];
      if (hand.length > 0) {
        events.push({ t: 'CardsRevealed', cards: [...hand], to: [obj.controller] });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
