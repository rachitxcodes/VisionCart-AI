import { describe, it, expect } from 'vitest';
import {
  GUIDES,
  FEATURE_CARDS,
  FAQ_LIST,
  filterAndSortGuides,
  filterFaqs,
} from './pages/GuideHubPage';

describe('Guide Hub (Job 2) Unit Tests', () => {
  it('contains all 6 core feature cards with title and description', () => {
    expect(FEATURE_CARDS).toHaveLength(6);
    FEATURE_CARDS.forEach((card) => {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.desc.length).toBeGreaterThan(0);
    });
  });

  it('contains exactly 9 plain-language step-by-step guides with IDs', () => {
    expect(GUIDES).toHaveLength(9);
    const expectedIds = [
      'guide-1',
      'guide-2',
      'guide-3',
      'guide-4',
      'guide-5',
      'guide-6',
      'guide-7',
      'guide-8',
      'guide-9',
    ];
    expect(GUIDES.map((g) => g.id)).toEqual(expectedIds);

    GUIDES.forEach((guide) => {
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      expect(['cashier', 'admin', 'both']).toContain(guide.audience);
    });
  });

  it('implements role-aware ordering for Cashier audience', () => {
    const cashierSorted = filterAndSortGuides(GUIDES, 'cashier', '');
    expect(cashierSorted).toHaveLength(9);
    // Cashier guides come first
    expect(cashierSorted[0].audience).toBe('cashier');
  });

  it('implements role-aware ordering for Admin audience', () => {
    const adminSorted = filterAndSortGuides(GUIDES, 'admin', '');
    expect(adminSorted).toHaveLength(9);
    // Admin guides come first
    expect(adminSorted[0].audience).toBe('admin');
  });

  it('filters guides accurately on live search query', () => {
    const cameraResults = filterAndSortGuides(GUIDES, 'all', 'camera');
    expect(cameraResults.length).toBeGreaterThan(0);
    cameraResults.forEach((g) => {
      const match =
        g.title.toLowerCase().includes('camera') ||
        g.steps.some((s) => s.toLowerCase().includes('camera'));
      expect(match).toBe(true);
    });

    const stockResults = filterAndSortGuides(GUIDES, 'all', 'stock');
    expect(stockResults.length).toBeGreaterThan(0);
  });

  it('contains FAQ items and filters them correctly', () => {
    expect(FAQ_LIST.length).toBeGreaterThanOrEqual(5);
    const results = filterFaqs(FAQ_LIST, 'insufficient stock');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('faq-3');
  });
});

