// `Halimar Depths` — enters tapped (the engine's line) and, on entry, looks
// at the top three cards of my library and puts them back in any order; the
// mana line is the engine's.

import { HALIMAR_DEPTHS } from '../../../data/fixtures/engineCards';
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
  HALIMAR_DEPTHS,
  'This land enters tapped.\nWhen this land enters, look at the top three cards of your library, then put them back in any order.\n{T}: Add {U}.',
);
const ENTERS = PRINTED.split('\n')[1] as string;

export const HALIMAR_DEPTHS_SCRIPT: CardScript = {
  oracleId: HALIMAR_DEPTHS.oracleId,
  name: HALIMAR_DEPTHS.name,
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
      label: () => 'Halimar Depths — look at the top three, put them back in any order',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const count = Math.min(3, library.length);
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
