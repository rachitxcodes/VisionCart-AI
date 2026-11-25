import { describe, it, expect } from 'vitest';
import { ReviewCandidate, Product, CorrectionCreateMeta } from './types';

const mockCandidates: ReviewCandidate[] = [
  {
    candidate_id: 'cand_bottle',
    predicted_class: 'bottle',
    confidence: 0.38,
    box: { x: 0.1, y: 0.1, w: 0.2, h: 0.3 },
    mapped_product_id: 1,
    mapped_product_name: 'Mineral Water Bottle 1L',
    mapped_product_price_paise: 4000,
  },
  {
    candidate_id: 'cand_backpack',
    predicted_class: 'backpack',
    confidence: 0.65,
    box: { x: 0.4, y: 0.2, w: 0.3, h: 0.4 },
    mapped_product_id: null,
  },
];

const mockCatalog: Product[] = [
  {
    id: 1,
    sku: 'PRD-BOT-004',
    name: 'Mineral Water Bottle 1L',
    category: 'Beverages',
    price_paise: 4000,
    gst_rate: 18,
    stock: 50,
    reorder_level: 10,
    detector_class: 'bottle',
    is_active: true,
  },
  {
    id: 2,
    sku: 'PRD-BAN-001',
    name: 'Fresh Organic Banana',
    category: 'Fresh Produce',
    price_paise: 6000,
    gst_rate: 0,
    stock: 100,
    reorder_level: 20,
    detector_class: 'banana',
    is_active: true,
  },
];

describe('Detection Correction Flow Logic Tests', () => {
  it('correctly categorizes confidence into Accept vs Review vs Ignore tiers', () => {
    const ACCEPT_CONF = 0.50;
    const REVIEW_CONF = 0.25;

    const categorize = (conf: number, hasMappedProduct: boolean) => {
      if (conf >= ACCEPT_CONF && hasMappedProduct) return 'CART';
      if (conf >= REVIEW_CONF) return 'REVIEW';
      return 'IGNORE';
    };

    expect(categorize(0.92, true)).toBe('CART');
    expect(categorize(0.92, false)).toBe('REVIEW'); // Unmapped class needs review
    expect(categorize(0.38, true)).toBe('REVIEW');  // Low confidence needs review
    expect(categorize(0.15, true)).toBe('IGNORE');  // Noise ignored
  });

  it('matches suggested products in catalog for review candidates', () => {
    const candidate = mockCandidates[0]; // bottle
    const match = mockCatalog.find(
      (p) => p.detector_class === candidate.predicted_class || p.id === candidate.mapped_product_id
    );
    expect(match).toBeDefined();
    expect(match?.name).toBe('Mineral Water Bottle 1L');
  });

  it('filters catalog items in product picker by query or SKU', () => {
    const filterCatalog = (query: string) => {
      const q = query.toLowerCase().trim();
      return mockCatalog.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    };

    expect(filterCatalog('water')).toHaveLength(1);
    expect(filterCatalog('water')[0].id).toBe(1);
    expect(filterCatalog('PRD-BAN')).toHaveLength(1);
    expect(filterCatalog('PRD-BAN')[0].id).toBe(2);
    expect(filterCatalog('xyz')).toHaveLength(0);
  });

  it('structures correction metadata accurately for backend API logging', () => {
    const candidate = mockCandidates[0];
    const chosenProduct = mockCatalog[0];

    const meta: CorrectionCreateMeta = {
      session_id: 'pos_test_123',
      correction_type: 'wrong_item',
      predicted_class: candidate.predicted_class,
      predicted_conf: candidate.confidence,
      box_x: candidate.box.x,
      box_y: candidate.box.y,
      box_w: candidate.box.w,
      box_h: candidate.box.h,
      corrected_product_id: chosenProduct.id,
      corrected_label: chosenProduct.detector_class,
      frame_width: 640,
      frame_height: 480,
    };

    expect(meta.correction_type).toBe('wrong_item');
    expect(meta.predicted_class).toBe('bottle');
    expect(meta.corrected_product_id).toBe(1);
    expect(meta.corrected_label).toBe('bottle');
  });
});
