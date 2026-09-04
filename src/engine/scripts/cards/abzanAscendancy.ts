// `Abzan Ascendancy` - "When this enchantment enters, put a +1/+1 counter on each
// creature you control." (D303's mass counter, hand-written because the second
// line is no library head) and "Whenever a nontoken creature you control dies,
// create a 1/1 white Spirit creature token with flying." (Golgari Germination's
// nontoken dies watcher, D177: the dying creature must have been YOURS).

import { ABZAN_ASCENDANCY } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  ABZAN_ASCENDANCY,
  'When this enchantment enters, put a +1/+1 counter on each creature you control.\nWhenever a nontoken creature you control dies, create a 1/1 white Spirit creature token with flying.',
);
const LINES = PRINTED.split('\n');

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|1/1|W|Creature|flying');

export const ABZAN_ASCENDANCY_SCRIPT: CardScript = {
  oracleId: ABZAN_ASCENDANCY.oracleId,
  name: ABZAN_ASCENDANCY.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Abzan Ascendancy - a +1/+1 counter on each creature you control',
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.query.controllerOf(self);
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== me) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: '+1/+1', delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.isToken) return false;
          if (inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => 'Abzan Ascendancy - create a 1/1 white Spirit with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
