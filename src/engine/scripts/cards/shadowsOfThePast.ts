// `Shadows of the Past` - a aCreatureDies trigger scry, an activation drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHADOWS_OF_THE_PAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHADOWS_OF_THE_PAST, "Whenever a creature dies, scry 1. (Look at the top card of your library. You may put that card on the bottom.)\n{4}{B}: Each opponent loses 2 life and you gain 2 life. Activate only if there are four or more creature cards in your graveyard.");
const LINES = PRINTED.split('\n');

export const SHADOWS_OF_THE_PAST_SCRIPT: CardScript = {
  oracleId: SHADOWS_OF_THE_PAST.oracleId,
  name: SHADOWS_OF_THE_PAST.name,
  activated: [
    {
      ref: `${SHADOWS_OF_THE_PAST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
        return out;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Shadows of the Past - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Shadows of the Past - scry 1" } },
        ];
      },
    },
  ],
};
