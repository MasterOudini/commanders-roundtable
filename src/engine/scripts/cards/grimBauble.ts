// `Grim Bauble` — "When this artifact enters, target creature an opponent
// controls gets -2/-2 until end of turn.\n{2}{B}, {T}, Sacrifice this
// artifact: Surveil 2. (reminder)" Ravenous Chupacabra's probed opponent
// spec on the entry aim (D237) with a debuff, and A.I.M. Synthoids' surveil
// (D195's rule: the ask is the LAST event) raised from an activation whose
// tap and sacrifice were charged at activation (D159). D275.

import { GRIM_BAUBLE } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  GRIM_BAUBLE,
  'When this artifact enters, target creature an opponent controls gets -2/-2 until end of turn.\n{2}{B}, {T}, Sacrifice this artifact: Surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);
const ENTRY = PRINTED.split('\n')[0] as string;
const SURVEIL = PRINTED.split('\n')[1] as string;

export const GRIM_BAUBLE_SCRIPT: CardScript = {
  oracleId: GRIM_BAUBLE.oracleId,
  name: GRIM_BAUBLE.name,
  triggers: [
    {
      abilityId: 'etb-debuff',
      text: ENTRY,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTRY),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Grim Bauble — target creature an opponent controls gets -2/-2',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: -2, keywords: [] }];
      },
    },
  ],
  activated: [
    {
      ref: `${GRIM_BAUBLE.oracleId}#a0`,
      text: SURVEIL,
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
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
