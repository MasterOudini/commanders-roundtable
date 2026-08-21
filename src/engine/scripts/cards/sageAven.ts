// `Sage Aven` — "Flying (…) / When this creature enters, look at the top
// four cards of your library, then put them back in any order." The Sage
// Owl trigger: D142's ordering ask raised from a resolve — the D196
// scry-trigger argument one prompt over. D242.

import { SAGE_AVEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SAGE_AVEN,
  "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhen this creature enters, look at the top four cards of your library, then put them back in any order.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SAGE_AVEN_SCRIPT: CardScript = {
  oracleId: SAGE_AVEN.oracleId,
  name: SAGE_AVEN.name,
  triggers: [
    {
      abilityId: 'etb-order',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Sage Aven — put the top four back in any order',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        if (library.length === 0) return [];
        const top = library.slice(Math.max(0, library.length - 4));
        const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: [obj.controller] }];
        if (top.length > 1) {
          events.push({
            t: 'AwaitingSet',
            awaiting: {
              kind: 'orderCards',
              player: obj.controller,
              zone: 'library',
              destination: 'top',
              count: top.length,
              label: obj.label,
            },
          });
        } else {
          // One card has one sequence — nothing to decide; clear the look.
          events.push({ t: 'CardsRevealed', cards: top, to: [] });
        }
        return events;
      },
    },
  ],
};
