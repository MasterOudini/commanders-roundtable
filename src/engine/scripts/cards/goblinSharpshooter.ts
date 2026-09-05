// `Goblin Sharpshooter` - a static noUntap, a aCreatureDies trigger untapSelf, an activation damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_SHARPSHOOTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_SHARPSHOOTER, "This creature doesn't untap during your untap step.\nWhenever a creature dies, untap this creature.\n{T}: This creature deals 1 damage to any target.");
const LINES = PRINTED.split('\n');

export const GOBLIN_SHARPSHOOTER_SCRIPT: CardScript = {
  oracleId: GOBLIN_SHARPSHOOTER.oracleId,
  name: GOBLIN_SHARPSHOOTER.name,
  activated: [
    {
      ref: `${GOBLIN_SHARPSHOOTER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount ?? 0,
                applyAs: target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'aCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Goblin Sharpshooter - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D325).
      applies: (ctx, self, ev) =>
        ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self) && ev.cards.includes(self),
      replace: (_ctx, self, ev): readonly EventBody[] => {
        if (ev.t !== 'PermanentsUntapped') return [ev];
        const cards = ev.cards.filter((c) => c !== self);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
};
