// `Sea Gate Oracle` — "When this creature enters, look at the top two
// cards of your library. Put one of them into your hand and the other on
// the bottom of your library." The FIRST trigger-raised library TAKE:
// D141's chooseFromZone ask emitted from a resolve (the Sage Owl
// argument one prompt over). D244.

import { SEA_GATE_ORACLE } from '../../../data/fixtures/engineCards';
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
  SEA_GATE_ORACLE,
  'When this creature enters, look at the top two cards of your library. Put one of them into your hand and the other on the bottom of your library.',
);

export const SEA_GATE_ORACLE_SCRIPT: CardScript = {
  oracleId: SEA_GATE_ORACLE.oracleId,
  name: SEA_GATE_ORACLE.name,
  triggers: [
    {
      abilityId: 'etb-look',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Sea Gate Oracle — take one of the top two',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        if (library.length === 0) return [];
        const top = library.slice(Math.max(0, library.length - 2));
        const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: [obj.controller] }];
        if (top.length === 1) {
          // One card: the whole look goes to the hand (CR 701.8a's shape).
          events.push({
            t: 'CardsMoved',
            moves: [
              {
                card: top[0] as string,
                from: { kind: 'library', player: obj.controller },
                to: { kind: 'hand', player: obj.controller },
              },
            ],
          });
          return events;
        }
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: obj.controller,
            zone: 'library',
            rest: 'bottom',
            count: 1,
            label: obj.label,
          },
        });
        return events;
      },
    },
  ],
};
