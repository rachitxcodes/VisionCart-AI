import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Search,
  Camera,
  ShoppingBag,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Package,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
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
    key: 'rbac',
    title: 'Role-Based Access Control',
    desc: 'Secure isolation ensuring Cashiers focus on POS and Admins manage business operations.',
  },
];

// 9 Step-by-Step How-To Guides
export const GUIDES: GuideStep[] = [
  {
    id: 'guide-1',
    title: '1. Log In and Log Out',
    audience: 'both',
    steps: [
      'Open the login screen at /login in your web browser.',
      'Enter your email address and password, or click one of the quick Demo buttons.',
      'Click the "Sign In" button to enter your workstation.',
      'When finished, click the "Logout" button at the top right of the navigation bar.',
    ],
  },
  {
    id: 'guide-2',
    title: '2. Start the Camera and Scan Products',
    audience: 'cashier',
    steps: [
      'Navigate to the Cashier POS station from the top navigation bar.',
      'Click the green "Start Camera" button in the scanner header.',
      'When your browser asks for permission, click "Allow".',
      'Hold any product steady in front of the lens for 1-2 seconds.',
      'The camera draws a green box around the item and adds it to the customer cart.',
    ],
  },
  {
    id: 'guide-3',
    title: '3. What to Do If the Camera Doesn\'t Work',
    audience: 'cashier',
    steps: [
      'Check the browser address bar icon and ensure camera permission is set to "Allow".',
      'If no webcam is connected, click the "Simulate Feed" button to test with demo frames.',
      'Alternatively, use the "+ Add manual item" dropdown at the top of the cart to select items.',
      'Click "Add" to put the selected item straight into the active cart.',
    ],
  },
  {
    id: 'guide-4',
    title: '4. Add, Remove, or Change Items in the Cart by Hand',
    audience: 'cashier',
    steps: [
      'To add an item manually, pick it from the catalog dropdown and click "Add".',
      'To increase quantity, click the "+" button next to the item count.',
      'To decrease quantity, click the "-" button.',
      'To remove an item completely, click the red trash can icon.',
      'To reset the customer basket, click the "Clear Cart" button at the top of the cart.',
    ],
  },
  {
    id: 'guide-5',
    title: '5. Check Out and Download the Invoice',
    audience: 'cashier',
    steps: [
      'Review the line items, taxable value, CGST, SGST, and Grand Total.',
      'Click the green "Pay & Generate Tax Invoice" button.',
      'The invoice modal appears with a green checkmark and complete tax breakdown.',
      'Click "Download Tax Invoice (PDF)" to save a printable receipt for the customer.',
      'Click "New Transaction" to reset the cart for the next customer.',
    ],
  },
  {
    id: 'guide-6',
    title: '6. Add a New Product (Admin)',
    audience: 'admin',
    steps: [
      'Open the Products management page (/admin/products) from the top bar.',
      'Click the blue "Add New Product" button at the top right.',
      'Enter the unique SKU, product name, price in paise (e.g., 5000 = ₹50.00), and category.',
      'Select the GST tax rate (0%, 5%, 12%, 18%, or 28%).',
      'Set initial stock units, reorder alert level, and detector label (e.g., banana).',
      'Click "Save Product" to publish the item to the catalog.',
    ],
  },
  {
    id: 'guide-7',
    title: '7. Update Stock and Handle Low-Stock Alerts (Admin)',
    audience: 'admin',
    steps: [
      'In the Products list, locate the item you want to adjust and click the Sliders icon.',
      'Choose an action: ADD (receive stock), DEDUCT (damaged/expired), or SET (audit count).',
      'Enter the quantity and select the reason from the dropdown.',
      'Click "Apply Stock Change". The change is logged in the audit ledger.',
      'On the Analytics Dashboard, view items highlighted in red and click "+10 Restock" for quick replenishment.',
    ],
  },
  {
    id: 'guide-8',
    title: '8. Link a Product to What the Camera Sees (Admin)',
    audience: 'admin',
    steps: [
      'In the Products table, click the Edit pencil icon next to any product.',
      'Scroll down to the "Detector Class Mapping" field.',
      'Type the exact label the AI camera detects (e.g., "apple", "banana", "bottle", "cup", "donut").',
      'Click "Save Product".',
      'The next time that object appears in the camera, VisionCart maps it to this catalog item.',
    ],
  },
  {
    id: 'guide-9',
    title: '9. Read the Analytics Dashboard (Admin)',
    audience: 'admin',
    steps: [
      'Open the Analytics dashboard (/admin/dashboard) from the top bar.',
      'Review the 4 top KPI cards: Total Revenue, Invoices Issued, Average Basket, and Low-Stock count.',
      'Use the "Last 7d", "Last 14d", and "Last 30d" filters to change the time window.',
      'Examine the Area Chart to spot sales peaks and the Bar Chart for top-selling items.',
      'Check the Critical Low-Stock Alerts grid at the bottom to reorder depleted inventory.',
    ],
  },
];

// FAQ Items
export const FAQ_LIST: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'What should I do if an item is not detected by the camera?',
    answer:
      'Ensure the item is well-lit and not covered by your hands. Hold the product still in the center of the frame for 1-2 seconds. If it still does not detect, use the manual dropdown above the cart to select the item and click Add.',
  },
  {
    id: 'faq-2',
    question: 'Why did the camera detect the wrong item?',
    answer:
      'Objects with similar shapes or colors may occasionally be confused under low light. You can click the trash icon next to the incorrect line item in the cart and add the correct product using the manual catalog selector.',
  },
  {
    id: 'faq-3',
    question: 'What does the "Insufficient stock" error message mean?',
    answer:
      'This warning appears when the requested quantity exceeds physical inventory. The transaction rolls back cleanly with zero charge. An administrator can restock the item in the Products page or Dashboard to allow the sale.',
  },
  {
    id: 'faq-4',
    question: 'Why is my PDF invoice not downloading?',
    answer:
      'Make sure your browser is not blocking pop-ups or automatic file downloads. You can also re-download any completed invoice by opening the invoice modal or asking your store administrator to inspect historical records.',
  },
  {
    id: 'faq-5',
    question: 'My browser says "Camera permission was denied". How do I fix it?',
    answer:
      'Click the lock or camera icon on the left side of your browser URL address bar. Change Camera from "Block" to "Allow", and reload the page. Alternatively, use the "Simulate Feed" button to test the POS without a camera.',
  },
];

export function filterAndSortGuides(
  guidesList: GuideStep[],
  selectedAudience: 'all' | 'cashier' | 'admin',
  searchQuery: string
): GuideStep[] {
  let list = guidesList;
  if (selectedAudience === 'cashier') {
    list = [...guidesList].sort((a, b) => (a.audience === 'cashier' ? -1 : b.audience === 'cashier' ? 1 : 0));
  } else if (selectedAudience === 'admin') {
    list = [...guidesList].sort((a, b) => (a.audience === 'admin' ? -1 : b.audience === 'admin' ? 1 : 0));
  }

  if (!searchQuery.trim()) return list;
  const q = searchQuery.toLowerCase();
  return list.filter(
    (g) =>
      g.title.toLowerCase().includes(q) ||
      g.steps.some((s) => s.toLowerCase().includes(q))
  );
}

export function filterFaqs(faqItems: FAQItem[], searchQuery: string): FAQItem[] {
  if (!searchQuery.trim()) return faqItems;
  const q = searchQuery.toLowerCase();
  return faqItems.filter(
    (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
  );
}

export const GuideHubPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<'all' | 'cashier' | 'admin'>(
    isAdmin ? 'admin' : 'cashier'
  );
  const [openFaqIds, setOpenFaqIds] = useState<string[]>(['faq-1']);

  // Feature Highlights
  const featureCardsWithIcons = [
    {
      icon: <Camera className="w-5 h-5 text-emerald-400" />,
      ...FEATURE_CARDS[0],
    },
    {
      icon: <ShoppingBag className="w-5 h-5 text-indigo-400" />,
      ...FEATURE_CARDS[1],
    },
    {
      icon: <Receipt className="w-5 h-5 text-sky-400" />,
      ...FEATURE_CARDS[2],
    },
    {
      icon: <Package className="w-5 h-5 text-amber-400" />,
      ...FEATURE_CARDS[3],
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-violet-400" />,
      ...FEATURE_CARDS[4],
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-teal-400" />,
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 text-slate-200">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
          <BookOpen className="w-3.5 h-3.5" />
          <span>VisionCart AI Help Center</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Guide Hub
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Learn VisionCart in minutes • Simple, step-by-step instructions for cashiers and store administrators
        </p>

        {/* Live Search Bar */}
        <div className="max-w-md mx-auto mt-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, answers, or troubleshooting topics..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
          />
        </div>
      </div>

      {/* Section 1: What Can VisionCart Do? */}
      <div>
        <div className="mb-4 flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">What can VisionCart do?</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureCardsWithIcons.map((feat, idx) => (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md hover:border-slate-700 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 mb-3">
                {feat.icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Step-by-Step How-To Guides */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Step-by-Step How-To Guides</span>
            </h2>
            <p className="text-xs text-slate-400">
              Ordered for your role: <span className="font-semibold text-indigo-400">{user?.role || 'User'}</span>
            </p>
          </div>

          {/* Role Filter Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex self-start sm:self-auto">
            <button
              onClick={() => setSelectedAudience('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedAudience === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Guides
            </button>
            <button
              onClick={() => setSelectedAudience('cashier')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedAudience === 'cashier'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cashier Station
            </button>
            <button
              onClick={() => setSelectedAudience('admin')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedAudience === 'admin'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Store Admin
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGuides.map((guide) => (
            <div
              key={guide.id}
              id={guide.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      guide.audience === 'admin'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : guide.audience === 'cashier'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}
                  >
                    {guide.audience}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">#{guide.id}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-3">{guide.title}</h3>
                <ol className="space-y-2 text-xs text-slate-300">
                  {guide.steps.map((step, sIdx) => (
                    <li key={sIdx} className="flex items-start space-x-2">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                        {sIdx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: FAQ & Troubleshooting Accordion */}
      <div>
        <div className="mb-4 flex items-center space-x-2">
          <HelpCircle className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-white">FAQ & Troubleshooting</h2>
        </div>

        <div className="space-y-2">
          {filteredFaqs.map((faq) => {
            const isOpen = openFaqIds.includes(faq.id);
            return (
              <div
                key={faq.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                >
                  <span className="text-xs font-semibold text-white">{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 mt-1">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Tips Box */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-5 shadow-lg flex items-start space-x-3.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 flex-shrink-0 mt-0.5">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white mb-1.5">Scanning Best Practices</h3>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
            <li><strong className="text-white">Good Lighting:</strong> Ensure the checkout counter has clear overhead lighting to minimize shadows.</li>
            <li><strong className="text-white">One Item at a Time:</strong> Introduce products steadily into the camera field for smoothest count updates.</li>
            <li><strong className="text-white">Keep Items Separated:</strong> Avoid stacking items directly on top of each other so bounding boxes don't overlap.</li>
          </ul>
        </div>
      </div>

      {/* Section 5: About & Project Credits */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 space-y-3">
        <div className="flex items-center space-x-2 text-white font-bold text-sm">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>About VisionCart AI</span>
        </div>
        <p className="leading-relaxed">
          VisionCart AI is a computer-vision powered retail checkout and inventory platform that replaces manual barcode scanning with automated real-time product recognition and GST-compliant invoicing.
        </p>
        <p className="font-mono text-slate-300">
          <strong>Technology Stack:</strong> React 18, Vite, Tailwind CSS, Recharts, FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL / SQLite, and Ultralytics YOLOv8.
        </p>
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-slate-500">
          <span>VisionCart AI Version: <strong>1.0.0</strong></span>
          <span className="font-semibold text-slate-400">
            Mini Project, 5th Semester, B.Tech CSE (AIML), GLA University
          </span>
        </div>
      </div>
    </div>
  );
};
