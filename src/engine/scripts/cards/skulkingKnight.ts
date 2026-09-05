// `Skulking Knight` - a becomesTargeted trigger sacrificeSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKULKING_KNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKULKING_KNIGHT, "Flanking (Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.)\nWhen this creature becomes the target of a spell or ability, sacrifice it.");
const LINES = PRINTED.split('\n');

export const SKULKING_KNIGHT_SCRIPT: CardScript = {
  oracleId: SKULKING_KNIGHT.oracleId,
  name: SKULKING_KNIGHT.name,
  triggers: [
    {
      abilityId: 'becomesTargeted-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Skulking Knight - sacrificeSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'graveyard', player: me.owner } }] }];
      },
    },
    {
      abilityId: 'becomesTargetedAbility-1',
      text: LINES[1] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Skulking Knight - sacrificeSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'graveyard', player: me.owner } }] }];
      },
    },
  ],
};
