// `Omen of the Sea` — "Flash (reminder)\nWhen this enchantment enters, scry
// 2, then draw a card.\n{2}{U}, Sacrifice this enchantment: Scry 2.
// (reminder)" D195's scry with the ask LAST, and the FIRST use of the
// scryChoice ask's `thenDraw` from a script: the engine draws the card
// after the answer, so "then" is honoured. An empty library skips the ask
// and simply draws (nothing). Flash is the engine's. D278.

import { OMEN_OF_THE_SEA } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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
  OMEN_OF_THE_SEA,
  'Flash (You may cast this spell any time you could cast an instant.)\nWhen this enchantment enters, scry 2, then draw a card.\n{2}{U}, Sacrifice this enchantment: Scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const SCRY = PRINTED.split('\n')[2] as string;

function scryTwo(ctx: ScriptCtx, controller: string, label: string, thenDraw: number): readonly EventBody[] {
  const library = ctx.state.zones.library[controller] ?? [];
  const n = Math.min(2, library.length);
  if (n === 0) return thenDraw > 0 ? [...drawEvents(ctx.state, controller, thenDraw)] : [];
  const top = library.slice(library.length - n);
  return [
    { t: 'CardsRevealed', cards: top, to: [controller] },
    {
      t: 'AwaitingSet',
      awaiting: { kind: 'scryChoice', player: controller, count: n, toGraveyard: false, thenDraw, label },
    },
  ];
}

export const OMEN_OF_THE_SEA_SCRIPT: CardScript = {
  oracleId: OMEN_OF_THE_SEA.oracleId,
  name: OMEN_OF_THE_SEA.name,
  triggers: [
    {
      abilityId: 'enters-scry-draw',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Omen of the Sea — scry 2, then draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => scryTwo(ctx, obj.controller, obj.label, 1),
    },
  ],
  activated: [
    {
      ref: `${OMEN_OF_THE_SEA.oracleId}#a0`,
      text: SCRY,
      resolve: (ctx, _self, obj): readonly EventBody[] => scryTwo(ctx, obj.controller, obj.label, 0),
    },
  ],
};
