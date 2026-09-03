// `Inkfathom Divers` — Islandwalk is the engine's; on entry, look at the top
// four cards of my library and put them back in any order.

import { INKFATHOM_DIVERS } from '../../../data/fixtures/engineCards';
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
  INKFATHOM_DIVERS,
  "Islandwalk (This creature can't be blocked as long as defending player controls an Island.)\nWhen this creature enters, look at the top four cards of your library, then put them back in any order.",
);
const ENTERS = PRINTED.split('\n')[1] as string;

export const INKFATHOM_DIVERS_SCRIPT: CardScript = {
  oracleId: INKFATHOM_DIVERS.oracleId,
  name: INKFATHOM_DIVERS.name,
  triggers: [
    {
      abilityId: 'enters-look',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Inkfathom Divers — look at the top four, put them back in any order',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const count = Math.min(4, library.length);
        if (count === 0) return [];
        const top = library.slice(library.length - count);
        const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: [obj.controller] }];
        if (count > 1) {
          events.push({
            t: 'AwaitingSet',
            awaiting: { kind: 'orderCards', player: obj.controller, zone: 'library', destination: 'top', count, label: obj.label },
          });
        }
        return events;
      },
    },
  ],
};
