import { describe, expect, it } from 'vitest';
import { groupIdentical, packRow, sortByCluster, type PackItem } from './packRow';
import type { CardData } from '../../data/cardTypes';
import type { CardView } from '../../view/types';

function cardData(over: Partial<CardData> & { oracleId: string; typeLine: string }): CardData {
  return {
    scryfallId: `s-${over.oracleId}`,
    name: over.oracleId,
    layout: 'normal',
    faces: [
      {
        name: over.oracleId,
        manaCost: '',
        typeLine: over.typeLine,
        oracleText: '',
        flavorText: null,
        power: null,
        toughness: null,
        loyalty: null,
        defense: null,
        colors: [],
        artist: null,
        imageId: `s-${over.oracleId}`,
      },
    ],
    colorIdentity: [],
    cmc: 0,
    keywords: [],
    setCode: 'tst',
    collectorNumber: '1',
    commanderLegality: 'legal',
    singleImage: true,
    ...over,
  };
}

const FOREST = cardData({ oracleId: 'forest', typeLine: 'Basic Land — Forest' });
const BEAR = cardData({ oracleId: 'bear', typeLine: 'Creature — Bear' });
const RING = cardData({ oracleId: 'ring', typeLine: 'Artifact' });
const AURA = cardData({ oracleId: 'aura', typeLine: 'Enchantment — Aura' });

function view(id: string, card: CardData | null, over: Partial<CardView> = {}): CardView {
  return {
    instanceId: id,
    card,
    faceIndex: 0,
    faceDown: false,
    controller: 'p1',
    owner: 'p1',
    tapped: false,
    summoningSick: false,
    damage: 0,
    counters: {},
    power: null,
    toughness: null,
    attachedTo: null,
    isCommander: false,
    isToken: false,
    attacking: null,
    blocking: null,
    ...over,
  };
}

const noAttachments = () => [];

describe('groupIdentical', () => {
  it('collapses 12 identical Forests into ONE pile — the load-bearing case', () => {
    // Without this, a 4-player board does not fit at 1080p: a pod's row holds 5
    // cards and a real Commander board has 10 lands. See D19.
    const cards = Array.from({ length: 12 }, (_, i) => view(`f${i}`, FOREST));
    const items = groupIdentical(cards, noAttachments);
    expect(items).toHaveLength(1);
    expect(items[0]!.members).toHaveLength(12);
    expect(items[0]!.untapped).toBe(12);
    expect(items[0]!.cluster).toBe('land');
  });

  it('does NOT collapse a tapped Forest with untapped ones', () => {
    // ⚠️ This is decision-relevant, not cosmetic: merging them would hide that you
    // have exactly one untapped land left.
    const cards = [
      view('f0', FOREST),
      view('f1', FOREST),
      view('f2', FOREST, { tapped: true }),
    ];
    const items = groupIdentical(cards, noAttachments);
    expect(items).toHaveLength(2);
    const untappedPile = items.find((i) => i.untapped > 0)!;
    expect(untappedPile.members).toHaveLength(2);
    const tappedPile = items.find((i) => i.untapped === 0)!;
    expect(tappedPile.members).toHaveLength(1);
    // The pile carries its tap state as a LAYOUT fact too: a turned pile needs a
    // turned slot, and the packer cannot see the CardViews to work that out.
    expect(tappedPile.tapped).toBe(true);
    expect(untappedPile.tapped).toBe(false);
  });

  it('reports untapped/total so a pile can show "7/12 untapped"', () => {
    // Same oracle id, same everything, but split by tap state — so the pile
    // sub-badge is computed from two piles, and each is internally uniform.
    const cards = [
      ...Array.from({ length: 7 }, (_, i) => view(`u${i}`, FOREST)),
      ...Array.from({ length: 5 }, (_, i) => view(`t${i}`, FOREST, { tapped: true })),
    ];
    const items = groupIdentical(cards, noAttachments);
    const total = items.reduce((n, i) => n + i.members.length, 0);
    const untapped = items.reduce((n, i) => n + i.untapped, 0);
    expect(total).toBe(12);
    expect(untapped).toBe(7);
  });

  it('keeps cards with different counters apart', () => {
    const cards = [
      view('b0', BEAR, { counters: { '+1/+1': 1 } }),
      view('b1', BEAR, { counters: { '+1/+1': 2 } }),
      view('b2', BEAR),
    ];
    expect(groupIdentical(cards, noAttachments)).toHaveLength(3);
  });

  it('treats a zero counter as no counter', () => {
    const cards = [view('b0', BEAR, { counters: { '+1/+1': 0 } }), view('b1', BEAR)];
    expect(groupIdentical(cards, noAttachments)).toHaveLength(1);
  });

  it('never stacks a card that has an attachment', () => {
    // An enchanted Forest is not interchangeable with a bare one.
    const cards = [view('f0', FOREST), view('f1', FOREST), view('f2', FOREST)];
    const items = groupIdentical(cards, (id) => (id === 'f1' ? ['aura1'] : []));
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.attachments.length > 0)!.members).toEqual(['f1']);
  });

  it('never stacks hidden cards together', () => {
    // Two face-down permanents look identical but are not; merging them would
    // invent information the projection deliberately withheld.
    const cards = [view('x0', null, { faceDown: true }), view('x1', null, { faceDown: true })];
    expect(groupIdentical(cards, noAttachments)).toHaveLength(2);
  });

  it('keeps an attacker separate from an identical non-attacker', () => {
    const cards = [
      view('b0', BEAR, { attacking: 'p2' }),
      view('b1', BEAR),
      view('b2', BEAR, { attacking: 'p3' }),
    ];
    expect(groupIdentical(cards, noAttachments)).toHaveLength(3);
  });

  it('can be turned off entirely (the settings toggle)', () => {
    const cards = Array.from({ length: 12 }, (_, i) => view(`f${i}`, FOREST));
    expect(groupIdentical(cards, noAttachments, false)).toHaveLength(12);
  });

  it('assigns clusters from the type line', () => {
    const items = groupIdentical(
      [view('f', FOREST), view('r', RING), view('a', AURA), view('b', BEAR)],
      noAttachments,
    );
    expect(items.map((i) => i.cluster)).toEqual(['land', 'artifact', 'enchantment', 'artifact']);
  });
});

describe('packRow', () => {
  const OPTS = { rowWidth: 510, cardW: 83, cardH: 116, gap: 8, minCardH: 96 };
  const items = (n: number): PackItem[] =>
    Array.from({ length: n }, (_, i) => ({
      instanceId: `c${i}`,
      members: [`c${i}`],
      untapped: 1,
      tapped: false,
      attachments: [],
      cluster: 'artifact' as const,
    }));

  it('is empty for an empty band', () => {
    const row = packRow([], OPTS);
    expect(row.cards).toEqual([]);
    expect(row.scale).toBe(1);
    expect(row.scrolls).toBe(false);
  });

  it('centres a row that fits, at full size', () => {
    const row = packRow(items(3), OPTS);
    expect(row.scale).toBe(1);
    expect(row.scrolls).toBe(false);
    expect(row.width).toBe(3 * 83 + 2 * 8);
    expect(row.cards[0]!.x).toBeCloseTo((510 - row.width) / 2, 6);
  });

  it('fits 5 opponent cards in a 4-player pod row — the design constraint', () => {
    const row = packRow(items(5), OPTS);
    expect(row.scale).toBe(1);
    expect(row.overflow).toBe(0);
    expect(row.scrolls).toBe(false);
  });

  it('NEVER overlaps two cards in a row', () => {
    // The whole reason auto-stacking exists. An overlap hides the right edge of the
    // covered card, which is where the power/toughness badge is.
    for (const n of [1, 2, 5, 6, 8, 12, 20]) {
      const row = packRow(items(n), OPTS);
      const w = OPTS.cardW * row.scale;
      for (let i = 1; i < row.cards.length; i++) {
        expect(
          row.cards[i]!.x,
          `n=${n}, card ${i} overlaps ${i - 1}`,
        ).toBeGreaterThanOrEqual(row.cards[i - 1]!.x + w - 1e-6);
      }
    }
  });

  it('reserves the TURNED box for a tapped slot', () => {
    // A tapped card is a full quarter turn, so it is as wide as a card is tall.
    const one = packRow([{ ...items(1)[0]!, tapped: true }], OPTS);
    expect(one.cards[0]!.footprintW).toBe(116);
    expect(one.cards[0]!.footprintH).toBe(83);
    expect(one.width).toBe(116);
  });

  it('never overlaps an upright card with the one turned beside it', () => {
    // ⚠️ THE WHOLE REASON the packer knows about tap state. Reserving the upright
    // width for a turned card lays it across its neighbour, and the covered edge
    // is exactly where the power/toughness badge is.
    const row = packRow(
      [
        { ...items(1)[0]!, instanceId: 'a', tapped: true },
        { ...items(1)[0]!, instanceId: 'b', tapped: false },
        { ...items(1)[0]!, instanceId: 'c', tapped: true },
      ],
      OPTS,
    );
    for (let i = 1; i < row.cards.length; i++) {
      const prev = row.cards[i - 1]!;
      expect(row.cards[i]!.x, `card ${i} overlaps ${i - 1}`).toBeGreaterThanOrEqual(
        prev.x + prev.footprintW - 1e-6,
      );
    }
  });

  it('walks the same ladder for turned cards: shrink, then admit it scrolls', () => {
    // 5 upright opponent cards fit a 4-player pod row exactly. Turned, they need
    // 612 px in a 510 px row, and even the 0.83 floor only gets them to 512 — so
    // the honest answer is a scrolling row, not five cards lying on each other.
    const upright = packRow(items(5), OPTS);
    expect(upright.scale).toBe(1);
    expect(upright.scrolls).toBe(false);

    const turned = packRow(
      items(5).map((i) => ({ ...i, tapped: true })),
      OPTS,
    );
    expect(turned.scale).toBeLessThan(1);
    expect(turned.scrolls).toBe(true);
    expect(turned.overflow).toBeGreaterThan(0);

    // Four of them, however, fit at full size — which is what makes reserving the
    // real footprint affordable rather than a permanent tax on every row.
    const four = packRow(
      items(4).map((i) => ({ ...i, tapped: true })),
      OPTS,
    );
    expect(four.scale).toBe(1);
    expect(four.scrolls).toBe(false);
  });

  it('shrinks uniformly before it scrolls, and never past 0.83', () => {
    const row = packRow(items(6), OPTS);
    expect(row.scale).toBeLessThan(1);
    expect(row.scale).toBeGreaterThanOrEqual(0.83);
    expect(row.scrolls).toBe(false);
  });

  it('never shrinks a card below the readable floor', () => {
    // 116 × 0.83 = 96.3, so the 0.83 shrink floor and the 96 px height floor bind
    // at almost the same point here — deliberately.
    const row = packRow(items(20), { ...OPTS, cardH: 116, minCardH: 96 });
    expect(OPTS.cardH * row.scale).toBeGreaterThanOrEqual(96 - 0.5);
  });

  it('scrolls, with a +N count, once shrinking is exhausted', () => {
    const row = packRow(items(20), OPTS);
    expect(row.scrolls).toBe(true);
    expect(row.overflow).toBeGreaterThan(0);
    // A scrolling row starts flush left; centring it would hide cards on BOTH sides.
    expect(row.cards[0]!.x).toBe(0);
  });

  it('reserves height for tucked attachments', () => {
    const withAura: PackItem[] = [
      { instanceId: 'h', members: ['h'], untapped: 1, tapped: false, attachments: ['a1', 'a2'], cluster: 'artifact' },
    ];
    expect(packRow(withAura, OPTS).cards[0]!.extraH).toBe(26);
  });

  it('caps reserved attachment height at 3 visible', () => {
    const many: PackItem[] = [
      {
        instanceId: 'h',
        members: ['h'],
        untapped: 1,
        tapped: false,
        attachments: ['a1', 'a2', 'a3', 'a4', 'a5'],
        cluster: 'artifact',
      },
    ];
    expect(packRow(many, OPTS).cards[0]!.extraH).toBe(39);
  });

  it('adds a gap between support clusters', () => {
    const mixed: PackItem[] = [
      { instanceId: 'l', members: ['l'], untapped: 1, tapped: false, attachments: [], cluster: 'land' },
      { instanceId: 'a', members: ['a'], untapped: 1, tapped: false, attachments: [], cluster: 'artifact' },
      { instanceId: 'e', members: ['e'], untapped: 1, tapped: false, attachments: [], cluster: 'enchantment' },
    ];
    const row = packRow(mixed, { ...OPTS, clusterGap: 24 });
    const w = OPTS.cardW * row.scale;
    expect(row.cards[1]!.x - row.cards[0]!.x).toBeCloseTo(w + 8 + 24, 5);
    expect(row.cards[2]!.x - row.cards[1]!.x).toBeCloseTo(w + 8 + 24, 5);
  });

  it('survives a zero-width row instead of producing NaN', () => {
    const row = packRow(items(4), { ...OPTS, rowWidth: 0 });
    expect(row.cards.every((c) => Number.isFinite(c.x))).toBe(true);
    expect(Number.isFinite(row.scale)).toBe(true);
  });
});

describe('sortByCluster', () => {
  it('orders lands, then artifacts, then enchantments', () => {
    const items: PackItem[] = (['enchantment', 'land', 'artifact'] as const).map((cluster) => ({
      instanceId: cluster,
      members: [cluster],
      untapped: 1,
      tapped: false,
      attachments: [],
      cluster,
    }));
    expect(sortByCluster(items).map((i) => i.cluster)).toEqual([
      'land',
      'artifact',
      'enchantment',
    ]);
  });

  it('does not mutate its input', () => {
    const items: PackItem[] = [
      { instanceId: 'e', members: ['e'], untapped: 1, tapped: false, attachments: [], cluster: 'enchantment' },
      { instanceId: 'l', members: ['l'], untapped: 1, tapped: false, attachments: [], cluster: 'land' },
    ];
    sortByCluster(items);
    expect(items[0]!.cluster).toBe('enchantment');
  });
});
