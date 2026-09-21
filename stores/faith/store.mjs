// Faith Njogu: a real seller's store, hand-authored from faithnjogu.com (not generated from the dummy-data flow).
// Built into dist/stores/faith/ by scripts/build.mjs. Images live in ./images and are copied alongside the pages.
import { safeColors } from '../../pipeline/contrast.mjs';

const ROOT = '/stores/faith/'; // logos are referenced from every page depth, so they use absolute paths
const A = (key, label, value, filterable = false) => ({ key, label, values: [{ value }], filterable, selectable: false, evidence: 'faithnjogu.com', assumed: false });

const { color } = safeColors({
  paper: '#fbf8ff', surface: '#ffffff', ink: '#2a2140', muted: '#6b6480', line: '#e6dff3',
  accent: '#6d4bb8', accentInk: '#ffffff', soft: '#f1ebfb', highlight: '#f7941d',
});

export const shop = {
  type: 'shop', id: 'faith', name: 'Faith Njogu', wordmark: 'Faith Njogu',
  logo: `${ROOT}images/faith-njogu-logo.png`, logoWide: true,
  descriptor: 'Marriage Counselor & Relationship Coach', tagline: 'Marriage Counselor & Relationship Coach', eyebrow: 'Faith Njogu / marriage counselor & relationship coach',
  hero: {
    title: 'Rediscover Fulfillment in Your Relationship',
    body: 'Bring back the excitement, the intimacy and the lasting connection, with programs designed around real couples and real marriages.',
    variant: 'hero-photo', images: ['images/IMG_20211023_145026-1.jpg'],
    primary: 'Start Your Journey', secondary: 'Talk to Faith on WhatsApp',
  },
  footer: 'Faith Njogu is a certified marriage counselor and relationship coach helping couples and singles build relationships that feel alive and secure.',
  whatsapp: '254720399323',
  location: 'Hazina Towers, 16th Floor, Nairobi',
  payment: 'M-Pesa Till 947392 (Faith Njogu Global)',
  checkout: {
    verb: 'Book now', greeting: 'I\'d like to book:', submit: 'Send booking on WhatsApp ↗',
    intro: 'Tell Faith who is attending so she can confirm your place on WhatsApp.',
    payment: 'M-Pesa Till 947392 (Faith Njogu Global)',
    paymentNote: 'Please pay before, or right after, you send this booking so Faith can confirm your place.',
    cohorts: { 'rebuild-the-we': 'October 11 to 24' }, // fixed-date cohorts; the other programs are always open
  },
  favicon: `${ROOT}images/favicon-192.png`, coverPhotos: true, policy: null, currency: 'KSh', featuredCount: 3,
  home: {
    publish: false,
    trust: {
      items: ['Certified marriage counselor', 'Over a decade of experience', 'Featured on Tuko and GBS TV'],
      logosLabel: 'Featured on',
      logos: [{ src: `${ROOT}images/tuko-logo.png`, alt: 'Tuko' }, { src: `${ROOT}images/gbstv-logo.png`, alt: 'GBS TV' }],
    },
    testimonials: [
      { name: 'Mercy Ikenye', image: 'images/testimonial-01.png', quote: 'Faith’s guidance strengthened my marriage. I would recommend her to anyone.' },
      { name: 'Michael M', image: 'images/testimonial-02.png', quote: 'The program taught me how to navigate the different stages of marriage successfully.' },
    ],
    about: {
      title: 'Who is Faith Njogu',
      image: 'images/IMG_20211023_145026-1.jpg',
      body: [
        'Faith Njogu is a certified marriage counselor and relationship coach based in Nairobi, with over a decade of experience walking with couples and singles.',
        'Her programs give you structure instead of guesswork: practical tools for hard conversations, for rebuilding trust and for keeping the spark alive.',
      ],
      cta: { label: 'Start coaching with Faith', href: 'shop.html' },
    },
  },
  theme: {
    color,
    type: { display: 'Playfair Display', displayWeight: 600, body: 'DM Sans', tracking: '-0.02em' },
    shape: { radius: '14px', card: 'soft', button: 'pill', density: 'airy' },
  },
};

export const products = [
  {
    type: 'product', id: 'rebuild-the-we', slug: 'rebuild-the-we', name: '10 Days to Rebuild the “We” in Your Marriage',
    price: 1000, priceNote: 'per couple', image: 'images/holding-hands.jpg',
    description: 'A short, structured in-person reset for couples: daily guided sessions plus the accountability of other couples going through it alongside you.',
    attributes: [A('category', 'Category', 'In-person program', true)],
    facts: [{ label: 'Format', value: 'In-person, group, Nairobi (Hazina Towers)' }, { label: 'Dates', value: 'Next cohort: 10 days, October 11 to 24' }],
    sections: [
      { title: 'What you will cover', items: [
        'Days 1 and 2: Reset and understand what is really going on beneath surface arguments',
        'Day 3: Building a consistently safe emotional space',
        'Days 4 and 5: Practical language for hard conversations',
        'Days 6 and 7: Guided trust-rebuilding exercises, done together in the room',
        'Days 8 and 9: Spotting and breaking recurring conflict patterns',
        'Day 10: Leave with a written plan as a couple',
      ] },
      { title: 'Who it is for', items: ['Couples wanting a reset without a multi-week commitment', 'Newlyweds', 'Couples entering a big life change', 'Anyone who wants structure over open-ended coaching'] },
    ],
  },
  {
    type: 'product', id: 'magnetize-your-love', slug: 'magnetize-your-love', name: 'Magnetize Your Love',
    price: 45000, image: 'images/magnetize-your-love-program.jpg',
    description: 'An 8-week online coaching journey that helps singles and couples reignite attraction, rebuild intimacy and create a relationship that feels alive and secure.',
    attributes: [A('category', 'Category', 'Online program', true)],
    facts: [{ label: 'Format', value: 'Online, self-paced with weekly structure' }, { label: 'Length', value: '8 weeks' }, { label: 'Start', value: 'Any time, enrolment is always open' }],
    sections: [
      { title: 'What you will cover', items: [
        'Week 1: Root sources of conflict vs. surface symptoms',
        'Week 2: Core communication skills',
        'Week 3: Creating emotional safety',
        'Week 4: Spotting recurring conflict patterns',
        'Week 5: Resolution and reconnection strategies',
        'Week 6: Understanding personality types in relationships',
        'Week 7: Power and true intimacy',
        'Week 8: Intimacy beyond the physical',
      ] },
      { title: 'Who it is for', items: ['Couples deepening an existing bond', 'Individuals wanting healthier relationships', 'People rebuilding after a breakup', 'Busy professionals'] },
    ],
  },
  {
    type: 'product', id: 'spicy-love-masterclass', slug: 'spicy-love-masterclass', name: 'Spicy Love Masterclass',
    price: 24000, priceNote: 'or USD $149 for international clients', image: 'images/ignite-your-love-program.jpg',
    description: 'A focused masterclass that helps couples break out of repeating arguments and reconnect, with root-cause tools rather than quick fixes.',
    attributes: [A('category', 'Category', 'Online masterclass', true)],
    facts: [{ label: 'Format', value: 'Online masterclass, self-paced' }, { label: 'Access', value: 'Lifetime' }, { label: 'Start', value: 'Any time, enrolment is always open' }],
    sections: [
      { title: 'What is included', items: [
        'Core training: root-cause discovery, techniques for open and honest conversation, and one core communication tool to stop conflicts escalating',
        'Bonus: full video library',
        'Bonus: private community access',
        'Bonus: one personal coaching call with Faith',
      ] },
      { title: 'Who it is for', items: ['Couples stuck in repeating arguments', 'Partners who shut down or escalate under stress', 'Anyone wanting more passion without being “in crisis”'] },
    ],
  },
];
