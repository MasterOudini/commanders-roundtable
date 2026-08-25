// `Windrider Patrol` — flying plus a connect trigger paying a scry 2.
//
// ⚠️ D259's rule: the printed line SAYS "combat damage", so ONE def watching
// `CombatDamageDealt` is right and a second `DamageDealt` arm would OVER-fire
// on every noncombat ping. Scroll Thief (D244) is the shipped precedent for
// exactly this wording. The keyword line never counts, so the def's text is
// `split[1]`. D269.

import { WINDRIDER_PATROL } from '../../../data/fixtures/engineCards';
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
  WINDRIDER_PATROL,
  'Flying\nWhenever this creature deals combat damage to a player, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const WINDRIDER_PATROL_SCRIPT: CardScript = {
  oracleId: WINDRIDER_PATROL.oracleId,
  name: WINDRIDER_PATROL.name,
  triggers: [
    {
      abilityId: 'connect-scry',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Windrider Patrol — scry 2',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
