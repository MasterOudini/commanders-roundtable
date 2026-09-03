// `Delusions of Mediocrity` - two triggers on itself: gain 10 life when it enters,
// lose 10 when it leaves the battlefield (a look-back trigger). Whole after D295's
// "you lose N life" sentence reading; the scripts are the triggers' own.

import { DELUSIONS_OF_MEDIOCRITY } from '../../../data/fixtures/engineCards';
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
  DELUSIONS_OF_MEDIOCRITY,
  'When this enchantment enters, you gain 10 life.\nWhen this enchantment leaves the battlefield, you lose 10 life.',
);
const ENTERS_TEXT = PRINTED.split('\n')[0] as string;
const LEAVES_TEXT = PRINTED.split('\n')[1] as string;

export const DELUSIONS_OF_MEDIOCRITY_SCRIPT: CardScript = {
  oracleId: DELUSIONS_OF_MEDIOCRITY.oracleId,
  name: DELUSIONS_OF_MEDIOCRITY.name,
  triggers: [
    {
      abilityId: 'etb',
      text: ENTERS_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Delusions of Mediocrity - gain 10 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 10, to: me.life + 10 }];
      },
    },
    {
      abilityId: 'leaves',
      text: LEAVES_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: [],
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => 'Delusions of Mediocrity - lose 10 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -10, to: me.life - 10 }];
      },
    },
  ],
};
