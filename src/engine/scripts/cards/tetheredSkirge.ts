// `Tethered Skirge` - a becomesTargeted trigger loseLifeSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TETHERED_SKIRGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TETHERED_SKIRGE, "Flying\nWhenever this creature becomes the target of a spell or ability, you lose 1 life.");
const LINES = PRINTED.split('\n');

export const TETHERED_SKIRGE_SCRIPT: CardScript = {
  oracleId: TETHERED_SKIRGE.oracleId,
  name: TETHERED_SKIRGE.name,
  triggers: [
    {
      abilityId: 'becomesTargeted-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Tethered Skirge - loseLifeSelf",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
    {
      abilityId: 'becomesTargetedAbility-1',
      text: LINES[1] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Tethered Skirge - loseLifeSelf",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
