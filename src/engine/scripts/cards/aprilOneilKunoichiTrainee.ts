// `April O'Neil, Kunoichi Trainee` - a etb trigger scry, a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APRIL_O_NEIL_KUNOICHI_TRAINEE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APRIL_O_NEIL_KUNOICHI_TRAINEE, "When April O'Neil enters, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)\nApril O'Neil can't be blocked by creatures with power 3 or greater.");
const LINES = PRINTED.split('\n');

export const APRIL_ONEIL_KUNOICHI_TRAINEE_SCRIPT: CardScript = {
  oracleId: APRIL_O_NEIL_KUNOICHI_TRAINEE.oracleId,
  name: APRIL_O_NEIL_KUNOICHI_TRAINEE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "April O'Neil, Kunoichi Trainee - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "April O'Neil, Kunoichi Trainee - scry 2" } },
        ];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) < 3,
    },
  ],
};
