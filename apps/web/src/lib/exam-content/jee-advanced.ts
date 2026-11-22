import type { ExamContent, ExamContentSet } from './types';

/**
 * JEE (Advanced) — exam pattern and syllabus.
 *
 * Written from one document, read for this file on 22 Nov 2026:
 *
 *   JEE (Advanced) 2026 Information Brochure — IIT Roorkee, organising
 *   institute. Clauses 9, 11, 17, 18, 20, 22, 24 and 26, and Annexure-I
 *   (Syllabi).
 *
 * The brochure deliberately does NOT fix the number of questions, the
 * question types or the marking scheme; those appear only in the
 * instructions on exam day and change between years. This page says so
 * rather than repeating a structure from a coaching site.
 *
 * Annexure-I lists units without grouping them. The Physical / Inorganic /
 * Organic split of Chemistry below is ours, for reading, and says so.
 *
 * When the 2027 brochure is published, re-read the clauses above and
 * Annexure-I against this file before changing `checkedOn`.
 */

const BROCHURE = {
  name: 'JEE (Advanced) 2026 Information Brochure',
  url: 'https://jeeadv.ac.in/documents/IBEnglish_2026_1.pdf',
  publishedBy: 'IIT Roorkee, for the Joint Admission Board',
} as const;

const CHECKED_ON = '2026-11-22';

const CYCLE_NOTE =
  'This is the 2026 brochure, the latest one published. JEE (Advanced) 2027 will be run by a different IIT, which publishes its own brochure; we will check this page against it.';

const examPattern: ExamContent = {
  lede: 'Two compulsory three-hour papers on the same day, each with Physics, Chemistry and Mathematics, taken on a computer. The question types are revealed only in the exam hall.',
  source: BROCHURE,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'The two papers',
      blocks: [
        {
          kind: 'table',
          caption: 'JEE (Advanced) 2026 papers and timings',
          head: ['Paper', 'Time (IST)', 'Duration', 'Subjects'],
          rows: [
            ['Paper 1', '09:00 – 12:00', '3 hours', 'Physics, Chemistry, Mathematics'],
            ['Paper 2', '14:30 – 17:30', '3 hours', 'Physics, Chemistry, Mathematics'],
          ],
          note: 'Both papers were held on Sunday 17 May 2026. Each paper has a separate section for each of the three subjects.',
        },
        {
          kind: 'list',
          items: [
            'Both papers are compulsory. Responses are evaluated, and a rank given, only if you appear for both.',
            'The exam is held only as a Computer Based Test (CBT). There is no pen-and-paper option.',
            'Questions are available in English and Hindi, and you can switch between the two at any point during the paper.',
          ],
        },
      ],
    },
    {
      title: 'What the brochure does not tell you in advance',
      blocks: [
        {
          kind: 'text',
          text: 'Unlike JEE Main, JEE (Advanced) does not publish its question pattern ahead of the exam. The brochure says only that negative marks may apply to some incorrect answers, and that the full details are in the instructions shown to candidates at the start of each paper. The number of questions, the mix of question types and the marks for each change from year to year.',
        },
        {
          kind: 'text',
          text: 'In practice that means two things. First, prepare for every common format — single-correct and multiple-correct multiple choice, numerical answers and matching — rather than for one fixed layout. Second, read the on-screen instructions for each section before answering, because a section where partial marks are possible needs a different approach from one where any wrong option costs marks.',
        },
      ],
    },
    {
      title: 'Who is included in the rank list',
      blocks: [
        {
          kind: 'text',
          text: 'Your rank comes from the total of Paper 1 and Paper 2. To be ranked at all you must clear a minimum in each subject and in the aggregate. The figures are percentages of the maximum marks.',
        },
        {
          kind: 'table',
          caption: 'Minimum marks for inclusion in each JEE (Advanced) 2026 rank list',
          head: ['Rank list', 'Each subject', 'Aggregate'],
          rows: [
            ['Common Rank List (CRL)', '10.0%', '35.0%'],
            ['GEN-EWS and OBC-NCL', '9.0%', '31.5%'],
            ['SC, ST and all PwD rank lists', '5.0%', '17.5%'],
            ['Preparatory course lists', '2.5%', '8.75%'],
          ],
          note: 'Clause 22 of the brochure. A candidate below the subject minimum in any one subject is not ranked, however high their total.',
        },
        {
          kind: 'list',
          items: [
            'Ties are broken first by positive marks: the candidate with more marks from correct answers ranks higher.',
            'If still tied, higher Mathematics marks rank higher; then higher Physics marks.',
            'If the tie remains after that, both candidates get the same rank.',
          ],
        },
      ],
    },
    {
      title: 'Who can sit the exam',
      blocks: [
        {
          kind: 'list',
          items: [
            'You must be among the top 2,50,000 successful candidates in the B.E./B.Tech. paper (Paper 1) of JEE (Main) of the same year.',
            'For 2026: born on or after 1 October 2001, or on or after 1 October 1996 for SC, ST and PwD candidates.',
            'At most two attempts, in two consecutive years.',
            'For 2026: you must have appeared in Class XII for the first time in 2025 or 2026, with Physics, Chemistry and Mathematics as compulsory subjects.',
            'For admission to an IIT you also need 75% aggregate in Class XII (65% for SC, ST and PwD), or a place in the category-wise top 20 percentile of your board.',
          ],
        },
      ],
    },
    {
      title: 'Architecture Aptitude Test (AAT)',
      blocks: [
        {
          kind: 'text',
          text: 'B.Arch. at IIT (BHU) Varanasi, IIT Kharagpur and IIT Roorkee needs one more test after JEE (Advanced). Only candidates who qualify JEE (Advanced) can take it. In 2026 it was a single three-hour paper in English, held on 4 June 2026, with registration on 1 and 2 June. You bring your own drawing and colouring materials.',
        },
        {
          kind: 'text',
          text: 'The AAT is pass or fail. There is no separate AAT rank: B.Arch. seats go by your JEE (Advanced) category rank, among those who pass.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many questions are there in JEE Advanced?',
      answer:
        'The brochure does not say, and the number changes from year to year. Each of the two papers has Physics, Chemistry and Mathematics sections; the question count and marks appear in the instructions at the start of the paper.',
    },
    {
      question: 'Is there negative marking in JEE Advanced?',
      answer:
        'For some questions, yes. The brochure says negative marks may apply to some incorrect answers and leaves the details to the exam-day instructions, so check each section’s rules before you answer.',
    },
    {
      question: 'Can I take only Paper 1?',
      answer:
        'You can sit it, but you will not be ranked. Both papers are compulsory, and only candidates who appear for both have their answers evaluated.',
    },
    {
      question: 'Is JEE Advanced offline?',
      answer:
        'No. Since 2018 it has been computer based only, and the 2026 brochure confirms CBT as the only mode.',
    },
    {
      question: 'What is the minimum score to get a JEE Advanced rank?',
      answer:
        'For the Common Rank List in 2026 you needed at least 10% of the maximum in each subject and 35% in aggregate. The thresholds are lower for GEN-EWS, OBC-NCL, SC, ST and PwD lists.',
    },
  ],
};

const PHYSICS_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'General',
    'Units and dimensions, measurement and errors, the listed practical experiments',
  ],
  [
    '2',
    'Mechanics',
    'Kinematics, Newton’s laws, work, energy and momentum, rigid bodies, oscillations, gravitation, fluids, waves',
  ],
  [
    '3',
    'Thermal Physics',
    'Thermal expansion, calorimetry, heat transfer, ideal gases, laws of thermodynamics, blackbody radiation',
  ],
  [
    '4',
    'Electricity and Magnetism',
    'Electrostatics, capacitors, DC circuits, magnetic fields, electromagnetic induction, LR, LC and LCR circuits',
  ],
  [
    '5',
    'Electromagnetic Waves',
    'Properties of EM waves and the electromagnetic spectrum with its uses',
  ],
  [
    '6',
    'Optics',
    'Reflection, refraction, prisms, lenses, interference, single-slit diffraction, polarisation',
  ],
  [
    '7',
    'Modern Physics',
    'Radioactive decay, binding energy, fission and fusion, photoelectric effect, Bohr’s theory, X-rays',
  ],
];

const MATHS_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Sets, Relations and Functions',
    'Set operations, equivalence relations, types of functions and operations on them',
  ],
  [
    '2',
    'Algebra',
    'Complex numbers, quadratic equations, progressions and means, logarithms, permutations and combinations, binomial theorem',
  ],
  [
    '3',
    'Matrices',
    'Matrix algebra, determinants and inverses up to order three, special matrices, simultaneous linear equations',
  ],
  [
    '4',
    'Probability and Statistics',
    'Addition and multiplication rules, conditional probability, Bayes’ theorem, mean, median, mode, dispersion, random variables',
  ],
  [
    '5',
    'Trigonometry',
    'Trigonometric functions and graphs, identities, equations, inverse trigonometric functions',
  ],
  [
    '6',
    'Analytical Geometry',
    'Straight lines and circles, conic sections, lines and planes in three dimensions, locus',
  ],
  [
    '7',
    'Differential Calculus',
    'Limits, continuity, derivatives, increasing and decreasing functions, maxima and minima, mean value theorems',
  ],
  [
    '8',
    'Integral Calculus',
    'Methods of integration, definite integrals, area under curves, first-order differential equations',
  ],
  [
    '9',
    'Vectors',
    'Addition, scalar multiplication, dot and cross products, scalar and vector triple products',
  ],
];

const CHEM_PHYSICAL: ReadonlyArray<readonly string[]> = [
  [
    'General topics',
    'Mole concept, chemical formulae and equations, stoichiometry, concentration units',
  ],
  [
    'States of Matter: Gases and Liquids',
    'Gas laws, ideal gas equation, kinetic theory, intermolecular forces, properties of liquids',
  ],
  [
    'Atomic Structure',
    'Bohr model, hydrogen spectrum, wave-particle duality, quantum numbers, shapes of orbitals, filling rules',
  ],
  [
    'Chemical Bonding and Molecular Structure',
    'Covalent bonding, hybridisation, molecular orbitals of diatomics, hydrogen bonding, polarity, VSEPR',
  ],
  [
    'Chemical Thermodynamics',
    'Work and heat, enthalpy, Hess’s law, entropy, Gibbs energy and spontaneity',
  ],
  [
    'Chemical and Ionic Equilibrium',
    'Equilibrium constants, Le Chatelier’s principle, solubility product, pH, buffers, hydrolysis of salts',
  ],
  [
    'Electrochemistry',
    'Cells and electrode potentials, Nernst equation, electrolysis, conductance, batteries, corrosion',
  ],
  [
    'Chemical Kinetics',
    'Rate laws, order and molecularity, half-life, Arrhenius equation, catalysis',
  ],
  [
    'Solid State',
    'Crystal systems, close packing, packing in lattices, radius ratio, point defects',
  ],
  [
    'Solutions',
    'Henry’s and Raoult’s laws, ideal solutions, colligative properties, van’t Hoff factor',
  ],
  ['Surface Chemistry', 'Adsorption and isotherms, colloids, emulsions, surfactants and micelles'],
];

const CHEM_INORGANIC: ReadonlyArray<readonly string[]> = [
  [
    'Classification of Elements and Periodicity in Properties',
    'Periodic law and table, electronic configuration, periodic trends',
  ],
  [
    'Hydrogen',
    'Isotopes, preparation, hydrides, water and heavy water, hydrogen peroxide, hydrogen as a fuel',
  ],
  [
    's-Block Elements',
    'Alkali and alkaline earth metals, anomalous lithium and beryllium, key sodium and calcium compounds',
  ],
  [
    'p-Block Elements',
    'Groups 13 to 18: reactivity, important compounds, allotropes, anomalous first members',
  ],
  [
    'd-Block Elements',
    'Oxidation states, electrode potentials, interstitial compounds, alloys, catalysis, oxoanions of Cr and Mn',
  ],
  [
    'f-Block Elements',
    'Lanthanoid and actinoid contraction, oxidation states, general characteristics',
  ],
  [
    'Coordination Compounds',
    'Werner’s theory, nomenclature, isomerism, bonding theories, magnetism and colour, metal carbonyls',
  ],
  [
    'Isolation of Metals',
    'Concentration of ores, metallurgy of Fe, Cu, Zn and Al, cyanide process, refining',
  ],
  [
    'Principles of Qualitative Analysis',
    'Group I to V cations; anions including nitrate, halides, carbonate, sulphate and sulphide',
  ],
  [
    'Environmental Chemistry',
    'Air, water and soil pollution, industrial waste, control of pollution, green chemistry',
  ],
];

const CHEM_ORGANIC: ReadonlyArray<readonly string[]> = [
  [
    'Basic Principles of Organic Chemistry',
    'Hybridisation of carbon, isomerism, IUPAC names, electronic effects, acidity and basicity, reactive intermediates',
  ],
  ['Alkanes', 'Homologous series, conformations, preparation, combustion, halogenation, oxidation'],
  [
    'Alkenes and Alkynes',
    'Preparation by elimination, hydration, oxidation by KMnO₄ and ozone, addition reactions',
  ],
  ['Benzene', 'Structure, electrophilic substitution, effect of directing groups'],
  [
    'Phenols',
    'Preparation, substitution, Reimer–Tiemann and Kolbe reactions, synthesis of aspirin',
  ],
  [
    'Alkyl Halides',
    'Rearrangement of carbocations, Grignard reactions, nucleophilic substitution and its stereochemistry',
  ],
  ['Alcohols', 'Esterification, dehydration, oxidation to carbonyl compounds and acids'],
  ['Ethers', 'Williamson synthesis, cleavage of the C–O bond'],
  [
    'Aldehydes and Ketones',
    'Preparation, oxidation and reduction, aldol and Cannizzaro reactions, haloform reaction, nucleophilic addition',
  ],
  ['Carboxylic Acids', 'Preparation, reduction, halogenation, esters, acid chlorides and amides'],
  [
    'Amines',
    'Preparation, Hofmann bromamide and Gabriel syntheses, diazonium salts, Hinsberg test',
  ],
  ['Haloarenes', 'Fittig and Wurtz–Fittig reactions, nucleophilic aromatic substitution'],
  ['Biomolecules', 'Carbohydrates, amino acids, peptides and proteins, nucleic acids'],
  [
    'Polymers',
    'Types of polymerisation, copolymers, natural, synthetic and biodegradable polymers',
  ],
  [
    'Chemistry in Everyday Life',
    'Drug action (antacids, antihistamines, analgesics and others), artificial sweeteners, soaps and detergents',
  ],
  [
    'Practical Organic Chemistry',
    'Detection of N, S and halogens; tests for hydroxyl, carbonyl, carboxyl, amino and nitro groups',
  ],
];

const syllabus: ExamContent = {
  lede: 'Every unit in Annexure-I of the brochure, subject by subject, with what each one covers. The same syllabus applies to both papers.',
  source: BROCHURE,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'How big the syllabus is',
      blocks: [
        {
          kind: 'table',
          caption: 'Number of units in each JEE (Advanced) subject',
          head: ['Subject', 'Units listed'],
          rows: [
            ['Physics', '7'],
            ['Chemistry', '37'],
            ['Mathematics', '9'],
          ],
          foot: ['Total', '53'],
        },
        {
          kind: 'text',
          text: 'The unit counts are not a measure of size. Physics has only seven units because Mechanics and Electricity and Magnetism are each very large, while Chemistry lists every family of organic compounds as its own unit. The brochure gives no weightage for any unit, and neither does this page.',
        },
        {
          kind: 'text',
          text: 'Compared with JEE Main the topics overlap heavily, so preparation for the two exams is largely the same work. The difference is depth: JEE (Advanced) questions often combine two or three units in one problem.',
        },
      ],
    },
    {
      title: 'Physics',
      blocks: [
        {
          kind: 'table',
          caption: 'JEE (Advanced) Physics units',
          head: ['Unit', 'Name', 'What it covers'],
          rows: PHYSICS_UNITS,
          note: 'The General unit includes a list of experiments, such as Vernier callipers and the screw gauge, g by simple pendulum, the resonance column and the meter bridge. Questions can be set on them, so read that list in the brochure.',
        },
      ],
    },
    {
      title: 'Chemistry',
      blocks: [
        {
          kind: 'text',
          text: 'The brochure lists Chemistry as one run of units. We have split it into the usual three parts below to make it easier to plan; the units and their order are the brochure’s.',
        },
        {
          kind: 'table',
          caption: 'JEE (Advanced) Chemistry: physical chemistry units',
          head: ['Unit', 'What it covers'],
          rows: CHEM_PHYSICAL,
        },
        {
          kind: 'table',
          caption: 'JEE (Advanced) Chemistry: inorganic chemistry units',
          head: ['Unit', 'What it covers'],
          rows: CHEM_INORGANIC,
        },
        {
          kind: 'table',
          caption: 'JEE (Advanced) Chemistry: organic chemistry units',
          head: ['Unit', 'What it covers'],
          rows: CHEM_ORGANIC,
        },
      ],
    },
    {
      title: 'Mathematics',
      blocks: [
        {
          kind: 'table',
          caption: 'JEE (Advanced) Mathematics units',
          head: ['Unit', 'Name', 'What it covers'],
          rows: MATHS_UNITS,
        },
      ],
    },
    {
      title: 'Architecture Aptitude Test syllabus',
      blocks: [
        {
          kind: 'list',
          items: [
            'Freehand drawing: common objects drawn from memory, in correct form and proportion.',
            'Geometrical drawing: lines, polygons, circles, and the plan and elevation of simple solids.',
            'Three-dimensional perception: forms, building elements, colour, volume and orientation.',
            'Imagination and aesthetic sensitivity: composition, context mapping, creativity and colour grouping.',
            'Architectural awareness: notable buildings, places and architects in India and abroad.',
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'Is the JEE Advanced syllabus the same as JEE Main?',
      answer:
        'Mostly. The topics overlap heavily, so most preparation serves both. The two syllabi are written by different bodies and are not identical, so check each list rather than assuming.',
    },
    {
      question: 'Does the syllabus differ between Paper 1 and Paper 2?',
      answer: 'No. One syllabus covers both papers; either paper can ask from any unit.',
    },
    {
      question: 'Is there chapter-wise weightage for JEE Advanced?',
      answer:
        'Not officially. The brochure gives no marks or number of questions per unit. Weightage tables on other sites are counts from past papers.',
    },
    {
      question: 'Are practical experiments part of the syllabus?',
      answer:
        'Yes. The Physics General unit lists specific experiments, and Chemistry includes qualitative analysis and practical organic chemistry.',
    },
  ],
};

export const JEE_ADVANCED_CONTENT: ExamContentSet = {
  'exam-pattern': examPattern,
  syllabus,
};
