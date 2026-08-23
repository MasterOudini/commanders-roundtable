// `Warteye Witch` — "Whenever this creature OR another creature you control
// dies, scry 1." The self-or-other pair (D259's Theoden shape, one verb over):
// ONE def covers both, because a death is a single `CardsMoved` and the two
// halves differ only in whether the mover is me.
//
// ⚠️ `looksBack: true` — the Witch is already in the graveyard when its own
// death is seen, so without it the self half never fires. D268.

import { WARTEYE_WITCH } from '../../../data/fixtures/engineCards';
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
  WARTEYE_WITCH,
  'Whenever this creature or another creature you control dies, scry 1.',
);

export const WARTEYE_WITCH_SCRIPT: CardScript = {
  oracleId: WARTEYE_WITCH.oracleId,
  name: WARTEYE_WITCH.name,
  triggers: [
    {
      abilityId: 'dies-scry',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          // The self half needs no controller check — it IS me.
          if (m.card === self) return true;
          if (m.from.player !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        });
      },
      label: () => 'Warteye Witch — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
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
