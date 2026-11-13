import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Camera,
  ShoppingBag,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface GuideStep {
  title: string;
  steps: string[];
  audience: 'cashier' | 'admin' | 'both';
  id: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

// 6 Feature Highlights
export const FEATURE_CARDS = [
  {
    key: 'real-time-vision',
    title: 'Real-Time Vision Recognition',
    desc: 'Point products at your webcam. VisionCart recognizes products instantly without barcode lasers.',
  },
  {
    key: 'automated-smart-cart',
    title: 'Automated Smart Cart',
    desc: 'Smart video smoothing prevents flickering and adds items with accurate counts.',
  },
  {
    key: 'gst-invoices',
    title: 'GST-Compliant Invoices',
    desc: 'Calculates exact CGST & SGST splits with integer paise precision and instant PDF download.',
  },
  {
    key: 'inventory-sync',
    title: 'Live Inventory Sync',
    desc: 'Deducts physical stock on checkout and blocks overselling with atomic transactions.',
  },
  {
    key: 'sales-analytics',
    title: 'Sales & Revenue Analytics',
    desc: 'Clear visual charts showing revenue trends, daily baskets, and low-stock reorder alerts.',
  },
  {
    key: 'atomic-transactions',
    title: 'Atomic & Idempotent Safety',
    desc: 'Row-level database locks ensure inventory is deducted once, preventing double-checkout.',
  },
];

// 9 Plain-language step-by-step guides
export const GUIDES: GuideStep[] = [
  {
    id: 'guide-1',
    title: 'How to Log In and Log Out',
    audience: 'both',
    steps: [
      'Open the login screen at /login in your browser.',
      'Enter your email address and password, or click one of the pre-filled demo account buttons.',
      'Click the "Sign in" button to enter the application.',
      'When your work shift is complete, click "Log out" in the top navigation bar.',
    ],
  },
  {
    id: 'guide-2',
    title: 'How to Start the Camera and Scan Items',
    audience: 'cashier',
    steps: [
      'Navigate to the Cashier POS page from the navigation bar.',
      'Click the green "Start camera" button above the video area.',
      'If prompted by your browser, click "Allow" to grant webcam access permissions.',
      'Hold catalog items in front of the lens. Recognized items will appear on the receipt.',
    ],
  },
  {
    id: 'guide-3',
    title: 'What to Do If the Camera Is Not Working',
    audience: 'cashier',
    steps: [
      'Check the address bar lock icon to verify camera permission is set to "Allow".',
      'Make sure no other desktop application is currently using your webcam hardware.',
      'If your computer does not have a webcam, click "Simulate feed" to test the system.',
      'Refresh your browser tab or restart your browser if hardware fails to initialize.',
    ],
  },
  {
    id: 'guide-4',
    title: 'How to Edit the Cart by Hand',
    audience: 'cashier',
    steps: [
      'To increase or decrease item quantities, click the "+" or "-" buttons on the receipt.',
      'To remove an item entirely from the current sale, click the "Remove" button on that line.',
      'To add items without scanning, use the product search dropdown at the top of the receipt.',
      'To discard all items and start over, click the "Clear" button in the receipt header.',
    ],
  },
  {
    id: 'guide-5',
    title: 'How to Complete Checkout and Download an Invoice',
    audience: 'cashier',
    steps: [
      'Verify that all customer products and quantities on the receipt are correct.',
      'Review the CGST, SGST, and grand total amounts calculated on the receipt.',
      'Click the full-width green "Take payment" button at the bottom of the receipt.',
      'When the tax invoice appears, click "Download PDF" to save or print the receipt.',
    ],
  },
  {
    id: 'guide-6',
    title: 'How to Add a New Product to the Catalog',
    audience: 'admin',
    steps: [
      'Open the Products page from the top navigation bar (administrator privileges required).',
      'Click the "Add product" button in the upper right corner.',
      'Enter the SKU, product name, category, price in paise (e.g., 5000 = ₹50.00), and GST rate.',
      'Enter the detector class name (e.g. "banana", "bottle") so the camera recognizes it.',
      'Click "Save product" to immediately activate the item in the store catalog.',
    ],
  },
  {
    id: 'guide-7',
    title: 'How to Update Stock and Handle Low-Stock Alerts',
    audience: 'admin',
    steps: [
      'Locate the product on the Products page or find it on the Analytics low-stock list.',
      'Click the adjust stock icon button in the action column.',
      'Select whether to add stock, deduct damaged goods, or set a new absolute count.',
      'Enter the quantity and select the audit reason, then click "Apply stock change".',
    ],
  },
  {
    id: 'guide-8',
    title: 'How to Link a Product to an AI Detector Label',
    audience: 'admin',
    steps: [
      'Open the Products page and click the edit icon for the target product.',
      'Find the "Detector class label" input field.',
      'Enter the lower-case COCO object label that the camera sees (e.g., "apple", "bottle", "cup").',
      'Click "Save product". The camera scanner will now automatically map that object to this product.',
    ],
  },
  {
    id: 'guide-9',
    title: 'How to Read the Business Analytics Dashboard',
    audience: 'admin',
    steps: [
      'Open the Analytics page from the top navigation bar.',
      'Select your analysis window: Last 7 days, 14 days, or 30 days.',
      'Review the key summary line and KPI metrics for total sales, invoice count, and average basket size.',
      'Inspect the daily revenue trend chart and top products list to gauge store velocity.',
    ],
  },
];

// 5 Comprehensive FAQ & Troubleshooting items
export const FAQ_LIST: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'How does VisionCart prevent item flickering during video scanning?',
    answer:
      'VisionCart applies temporal frame smoothing: an item must appear in at least 3 consecutive frames before it is added to the receipt, and is retained for 5 frames if temporarily obstructed.',
  },
  {
    id: 'faq-2',
    question: 'How are GST calculations split on invoices?',
    answer:
      'Each line item taxable value is computed from its unit price and quantity. Central GST (CGST) and State GST (SGST) are each calculated at exactly half the statutory GST rate in integer paise precision.',
  },
  {
    id: 'faq-3',
    question: 'What happens if a customer checks out an item with insufficient stock?',
    answer:
      'The checkout transaction is fully atomic. If any item exceeds available inventory, the entire sale rolls back with an inline error naming the depleted item. No partial deductions ever occur.',
  },
  {
    id: 'faq-4',
    question: 'What happens if a cashier clicks "Take payment" twice during a slow network connection?',
    answer:
      'Every checkout request includes a unique UUID idempotency key. If a request is submitted more than once, the backend returns the already-created invoice without re-deducting stock.',
  },
  {
    id: 'faq-5',
    question: 'Can I use VisionCart without physical camera hardware attached?',
    answer:
      'Yes. Click the "Simulate feed" button on the cashier counter. VisionCart will stream synthetic retail frames so you can test detection, receipt aggregation, and checkout.',
  },
];

// Pure filtering logic
export function filterAndSortGuides(
  guides: GuideStep[],
  audience: 'all' | 'cashier' | 'admin',
  query: string
): GuideStep[] {
  const q = query.trim().toLowerCase();

  return guides
    .filter((g) => {
      const matchesAudience = audience === 'all' || g.audience === audience || g.audience === 'both';
      if (!matchesAudience) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.steps.some((s) => s.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (audience === 'cashier') {
        if (a.audience === 'cashier' && b.audience !== 'cashier') return -1;
        if (b.audience === 'cashier' && a.audience !== 'cashier') return 1;
      } else if (audience === 'admin') {
        if (a.audience === 'admin' && b.audience !== 'admin') return -1;
        if (b.audience === 'admin' && a.audience !== 'admin') return 1;
      }
      return 0;
    });
}

export function filterFaqs(faqs: FAQItem[], query: string): FAQItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return faqs;
  return faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q)
  );
}

export const GuideHubPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<'all' | 'cashier' | 'admin'>(
    isAdmin ? 'admin' : 'cashier'
  );
  const [openFaqIds, setOpenFaqIds] = useState<string[]>(['faq-1']);

  const featureCardsWithIcons = [
    {
      icon: <Camera className="w-4 h-4 text-primary" />,
      ...FEATURE_CARDS[0],
    },
    {
      icon: <ShoppingBag className="w-4 h-4 text-primary" />,
      ...FEATURE_CARDS[1],
    },
    {
      icon: <Receipt className="w-4 h-4 text-primary" />,
      ...FEATURE_CARDS[2],
    },
    {
      icon: <Package className="w-4 h-4 text-primary" />,
      ...FEATURE_CARDS[3],
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-primary" />,
      ...FEATURE_CARDS[4],
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-primary" />,
      ...FEATURE_CARDS[5],
    },
  ];

  const filteredGuides = useMemo(
    () => filterAndSortGuides(GUIDES, selectedAudience, searchQuery),
    [searchQuery, selectedAudience]
  );

  const filteredFaqs = useMemo(
    () => filterFaqs(FAQ_LIST, searchQuery),
    [searchQuery]
  );

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10 font-body text-ink">
      {/* Header Banner - Printed Manual Styling */}
      <div className="border-b border-counter-grey pb-6">
        <span className="text-xs font-medium text-ink-muted block">Store reference manual</span>
        <h1 className="text-2xl font-heading font-semibold text-ink mt-1">
          Guide hub
        </h1>
        <p className="text-sm text-ink-muted mt-1.5 leading-relaxed max-w-prose">
          Clear, step-by-step instructions for cashiers and store administrators operating VisionCart.
        </p>

        {/* Live Search Bar */}
        <div className="mt-4 max-w-lg relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides and FAQs"
            className="w-full bg-surface border border-counter-grey rounded-control pl-9 pr-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-primary shadow-xs"
          />
        </div>
      </div>

      {/* Feature Capabilities */}
      <section className="space-y-4">
        <h2 className="text-base font-heading font-semibold text-ink">What VisionCart can do</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {featureCardsWithIcons.map((feat, idx) => (
            <div
              key={idx}
              className="bg-surface border border-counter-grey rounded-control p-3.5 shadow-xs flex flex-col"
            >
              <div className="w-7 h-7 rounded-control bg-paper flex items-center justify-center border border-counter-grey mb-2.5">
                {feat.icon}
              </div>
              <h3 className="text-xs font-semibold text-ink mb-1">{feat.title}</h3>
              <p className="text-[11px] text-ink-muted leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Step-by-Step Guides: Single column, max 70 chars per line, numbered sequences */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 border-b border-counter-grey pb-3">
          <div>
            <h2 className="text-base font-heading font-semibold text-ink">Step-by-step guides</h2>
            <p className="text-xs text-ink-muted">
              Showing guides for: <span className="font-medium text-ink">{user?.role || 'Staff'}</span>
            </p>
          </div>

          {/* Role Filter Tabs */}
          <div className="bg-surface border border-counter-grey rounded-control p-0.5 flex self-start sm:self-auto text-xs">
            <button
              onClick={() => setSelectedAudience('all')}
              className={`px-3 py-1 rounded-control font-medium transition-colors ${
                selectedAudience === 'all'
                  ? 'bg-paper text-ink font-semibold border border-counter-grey'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedAudience('cashier')}
              className={`px-3 py-1 rounded-control font-medium transition-colors ${
                selectedAudience === 'cashier'
                  ? 'bg-paper text-ink font-semibold border border-counter-grey'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Cashier
            </button>
            <button
              onClick={() => setSelectedAudience('admin')}
              className={`px-3 py-1 rounded-control font-medium transition-colors ${
                selectedAudience === 'admin'
                  ? 'bg-paper text-ink font-semibold border border-counter-grey'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        {filteredGuides.length === 0 ? (
          <div className="p-8 text-center text-ink-muted bg-surface border border-counter-grey rounded-control text-xs">
            No guides match your search query.
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl">
            {filteredGuides.map((guide) => (
              <article
                key={guide.id}
                id={guide.id}
                className="bg-surface border border-counter-grey rounded-panel p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-counter-grey pb-2">
                  <span className="text-[11px] font-medium text-ink-muted bg-paper px-2 py-0.5 rounded-control border border-counter-grey">
                    {guide.audience === 'both' ? 'All staff' : guide.audience === 'admin' ? 'Admin' : 'Cashier'}
                  </span>
                  <span className="text-[11px] font-mono text-ink-muted">#{guide.id}</span>
                </div>

                <h3 className="text-sm font-heading font-semibold text-ink">{guide.title}</h3>

                {/* Numbered list: real sequence steps */}
                <ol className="space-y-2 text-xs text-ink-muted">
                  {guide.steps.map((step, sIdx) => (
                    <li key={sIdx} className="flex items-start space-x-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-control bg-paper border border-counter-grey text-ink flex items-center justify-center text-[11px] font-mono font-medium mt-0.5">
                        {sIdx + 1}
                      </span>
                      <span className="leading-relaxed text-ink/90 pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* FAQ & Troubleshooting Accordion */}
      <section className="space-y-4 max-w-2xl">
        <h2 className="text-base font-heading font-semibold text-ink">Frequently asked questions</h2>

        {filteredFaqs.length === 0 ? (
          <div className="p-6 text-center text-ink-muted bg-surface border border-counter-grey rounded-control text-xs">
            No questions match your query.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className="bg-surface border border-counter-grey rounded-control overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full p-3.5 text-left flex items-center justify-between hover:bg-paper transition-colors"
                  >
                    <span className="text-xs font-medium text-ink">{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-ink-muted flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-ink-muted flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="p-3.5 pt-0 text-xs text-ink-muted leading-relaxed border-t border-counter-grey/60 mt-1">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Academic Credits & About */}
      <footer className="border-t border-counter-grey pt-5 text-xs text-ink-muted space-y-1.5">
        <p className="font-medium text-ink">VisionCart AI · Version 1.0.0</p>
        <p>Mini Project, 5th Semester, B.Tech CSE (AIML), GLA University</p>
      </footer>
    </div>
  );
};
