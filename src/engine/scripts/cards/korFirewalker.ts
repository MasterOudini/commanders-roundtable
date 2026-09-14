// `Kor Firewalker` - a castSpell trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOR_FIREWALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOR_FIREWALKER, "Protection from red\nWhenever a player casts a red spell, you may gain 1 life.");
const LINES = PRINTED.split('\n');

export const KOR_FIREWALKER_SCRIPT: CardScript = {
  oracleId: KOR_FIREWALKER.oracleId,
  name: KOR_FIREWALKER.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ctx.derive(ev.obj.card).colors.includes('R'),
      label: () => "Kor Firewalker - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
