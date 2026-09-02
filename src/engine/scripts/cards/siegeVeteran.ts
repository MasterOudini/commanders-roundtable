// `Siege Veteran` — "At the beginning of combat on your turn, put a +1/+1
// counter on target creature you control.\nWhenever another nontoken
// Soldier you control dies, create a 1/1 colorless Soldier artifact
// creature token." Combat Professor's aimed beginning-of-combat watcher
// (StepBegan on MY beginCombat, the ask as it goes on the stack) with a
// counter, and Headless Rider's nontoken-tribe dies watcher (D179) — the
// Veteran's own death is not "another" — making the pool's artifact Soldier.
// D280.

import { SIEGE_VETERAN } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { parseTargetClauses } from '../../../data/targetParse';
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
  SIEGE_VETERAN,
  'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.\nWhenever another nontoken Soldier you control dies, create a 1/1 colorless Soldier artifact creature token.',
);
const COMBAT = PRINTED.split('\n')[0] as string;
const DIES = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|1/1||Artifact Creature|');

export const SIEGE_VETERAN_SCRIPT: CardScript = {
  oracleId: SIEGE_VETERAN.oracleId,
  name: SIEGE_VETERAN.name,
  triggers: [
    {
      abilityId: 'begin-combat-counter',
      text: COMBAT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(COMBAT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Siege Veteran — +1/+1 counter on a creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
    {
      abilityId: 'soldier-dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard' || m.card === self) return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.isToken) return false;
          if (inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.subtypes.includes('Soldier');
        }),
      label: () => 'Siege Veteran — create a 1/1 Soldier artifact creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
