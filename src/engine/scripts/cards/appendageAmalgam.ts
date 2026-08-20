// `Appendage Amalgam` — "Whenever this creature attacks, surveil 1." The
// self-attack filter (Burrenton Shield-Bearers' shape, D166) raising the
// D195 ask with `toGraveyard: true` — the one flag that separates surveil
// from scry. Flash is a tier-2 keyword line. D198.

import { APPENDAGE_AMALGAM } from '../../../data/fixtures/engineCards';
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
  APPENDAGE_AMALGAM,
  'Flash\nWhenever this creature attacks, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const APPENDAGE_AMALGAM_SCRIPT: CardScript = {
  oracleId: APPENDAGE_AMALGAM.oracleId,
  name: APPENDAGE_AMALGAM.name,
  triggers: [
    {
      abilityId: 'attacks-surveil',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Appendage Amalgam — surveil 1',
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
