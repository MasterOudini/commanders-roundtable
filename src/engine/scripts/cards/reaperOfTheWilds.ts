// `Reaper of the Wilds` - a anyOtherCreatureDies trigger scry, an activation pumping itself, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { REAPER_OF_THE_WILDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(REAPER_OF_THE_WILDS, "Whenever another creature dies, scry 1.\n{B}: This creature gains deathtouch until end of turn.\n{1}{G}: This creature gains hexproof until end of turn.");
const LINES = PRINTED.split('\n');

export const REAPER_OF_THE_WILDS_SCRIPT: CardScript = {
  oracleId: REAPER_OF_THE_WILDS.oracleId,
  name: REAPER_OF_THE_WILDS.name,
  activated: [
    {
      ref: `${REAPER_OF_THE_WILDS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
    {
      ref: `${REAPER_OF_THE_WILDS.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["hexproof"] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'anyOtherCreatureDies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Reaper of the Wilds - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Reaper of the Wilds - scry 1" } },
        ];
      },
    },
  ],
};
