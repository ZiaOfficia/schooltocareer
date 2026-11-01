import type { ExamContent, ExamContentSet } from './types';

/**
 * NEET (UG) — exam pattern and syllabus.
 *
 * Written from two documents linked from neet.nta.nic.in, both read for this
 * file on 1 Nov 2026:
 *
 *   Information Bulletin, NEET (UG) 2026 — Chapter 4 (Examination Scheme),
 *     Chapter 6 (Eligibility) and Chapter 8 (Qualifying Criteria)
 *   Syllabus for NEET (UG) 2026 — NMC (UGMEB) public notice of 22 Dec 2025
 *
 * Every number below is in one of those two documents. The "what it covers"
 * column of the syllabus tables is a shortened reading of the NMC topic list
 * for that unit: it leaves topics out for length, it never adds one.
 *
 * The 2026 bulletin gives no minimum Class 12 percentage in Physics, Chemistry
 * and Biology, so this file does not state one. Older bulletins did; do not
 * copy a figure forward from them.
 *
 * When NTA publishes the 2027 bulletin, re-read Chapters 4, 6 and 8 against
 * this file before changing `checkedOn`.
 */

const BULLETIN = {
  name: 'NEET (UG) 2026 Information Bulletin',
  url: 'https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/02/202602231394640855.pdf',
  publishedBy: 'National Testing Agency',
} as const;

const SYLLABUS = {
  name: 'Syllabus for NEET (UG) 2026',
  url: 'https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf',
  publishedBy: 'National Medical Commission',
} as const;

const CHECKED_ON = '2026-11-01';

const CYCLE_NOTE =
  'This is the 2026 edition, the latest one published. When the 2027 bulletin and syllabus come out we will check this page against them.';

const PHYSICS_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Physics and Measurement',
    'SI units, least count, significant figures, errors, dimensional analysis',
  ],
  [
    '2',
    'Kinematics',
    'Motion in a straight line, position-time and velocity-time graphs, vectors, projectile motion, uniform circular motion',
  ],
  [
    '3',
    'Laws of Motion',
    'Newton’s laws, momentum and impulse, conservation of linear momentum, friction, circular motion',
  ],
  [
    '4',
    'Work, Energy and Power',
    'Work-energy theorem, kinetic and potential energy, power, conservative forces, collisions',
  ],
  [
    '5',
    'Rotational Motion',
    'Centre of mass, torque, angular momentum and its conservation, moment of inertia',
  ],
  [
    '6',
    'Gravitation',
    'Law of gravitation, variation of g, Kepler’s laws, escape velocity, satellites',
  ],
  [
    '7',
    'Properties of Solids and Liquids',
    'Elasticity and Hooke’s law, fluid pressure, viscosity, Bernoulli’s principle, surface tension, heat, calorimetry, heat transfer',
  ],
  [
    '8',
    'Thermodynamics',
    'Zeroth, first and second laws, isothermal and adiabatic processes, reversible and irreversible processes',
  ],
  [
    '9',
    'Kinetic Theory of Gases',
    'Equation of state, pressure and temperature from kinetic theory, RMS speed, degrees of freedom',
  ],
  [
    '10',
    'Oscillations and Waves',
    'Simple harmonic motion, spring and pendulum, wave motion, superposition, standing waves, beats',
  ],
  [
    '11',
    'Electrostatics',
    'Coulomb’s law, electric field and potential, dipoles, Gauss’s law, capacitors and dielectrics',
  ],
  [
    '12',
    'Current Electricity',
    'Drift velocity, Ohm’s law, resistivity, series and parallel circuits, Kirchhoff’s laws, Wheatstone bridge',
  ],
  [
    '13',
    'Magnetic Effects of Current and Magnetism',
    'Biot-Savart and Ampere’s laws, force on moving charges and conductors, galvanometer, magnetic materials',
  ],
  [
    '14',
    'Electromagnetic Induction and Alternating Currents',
    'Faraday’s and Lenz’s laws, inductance, AC circuits, LCR resonance, transformers',
  ],
  [
    '15',
    'Electromagnetic Waves',
    'Displacement current, properties of electromagnetic waves, the electromagnetic spectrum and its uses',
  ],
  [
    '16',
    'Optics',
    'Mirrors and lenses, refraction, total internal reflection, prisms, optical instruments, interference, diffraction, polarisation',
  ],
  [
    '17',
    'Dual Nature of Matter and Radiation',
    'Photoelectric effect, Einstein’s equation, matter waves and the de Broglie relation',
  ],
  [
    '18',
    'Atoms and Nuclei',
    'Rutherford and Bohr models, hydrogen spectrum, mass defect, binding energy, fission and fusion',
  ],
  [
    '19',
    'Electronic Devices',
    'Semiconductors, diodes as rectifiers, LED, photodiode, solar cell, Zener diode, logic gates',
  ],
  [
    '20',
    'Experimental Skills',
    'Standard school experiments, such as using Vernier calipers and a screw gauge and timing a simple pendulum',
  ],
];

const CHEMISTRY_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Physical',
    'Some Basic Concepts in Chemistry',
    'Mole concept, molar mass, empirical and molecular formulae, stoichiometry',
  ],
  [
    '2',
    'Physical',
    'Atomic Structure',
    'Hydrogen spectrum, Bohr model, dual nature of matter, quantum numbers, orbitals',
  ],
  [
    '3',
    'Physical',
    'Chemical Bonding and Molecular Structure',
    'Ionic and covalent bonds, VSEPR, hybridisation, molecular orbital theory, hydrogen bonding',
  ],
  [
    '4',
    'Physical',
    'Chemical Thermodynamics',
    'First and second laws, enthalpy, Hess’s law, entropy, Gibbs energy and spontaneity',
  ],
  [
    '5',
    'Physical',
    'Solutions',
    'Concentration units, Raoult’s law, colligative properties, abnormal molar mass',
  ],
  [
    '6',
    'Physical',
    'Equilibrium',
    'Chemical equilibrium, Le Chatelier’s principle, ionic equilibrium, pH, buffers, solubility product',
  ],
  [
    '7',
    'Physical',
    'Redox Reactions and Electrochemistry',
    'Oxidation number, balancing redox reactions, conductance, electrochemical cells, Nernst equation',
  ],
  [
    '8',
    'Physical',
    'Chemical Kinetics',
    'Rate of reaction, order and molecularity, rate law, zero and first-order reactions, activation energy',
  ],
  [
    '9',
    'Inorganic',
    'Classification of Elements and Periodicity in Properties',
    'Modern periodic table, periodic trends in radii, ionisation enthalpy, electron gain enthalpy, valence',
  ],
  [
    '10',
    'Inorganic',
    'p-Block Elements',
    'Groups 13 to 18: electronic configuration and trends in physical and chemical properties',
  ],
  [
    '11',
    'Inorganic',
    'd- and f-Block Elements',
    'Transition elements, lanthanoids and actinoids, trends in properties',
  ],
  [
    '12',
    'Inorganic',
    'Coordination Compounds',
    'Werner’s theory, ligands, IUPAC nomenclature, isomerism, valence bond and crystal field ideas',
  ],
  [
    '13',
    'Organic',
    'Purification and Characterisation of Organic Compounds',
    'Crystallisation, distillation, chromatography, detection of elements, quantitative analysis',
  ],
  [
    '14',
    'Organic',
    'Some Basic Principles of Organic Chemistry',
    'Hybridisation, functional groups, isomerism, IUPAC nomenclature, reaction mechanisms',
  ],
  [
    '15',
    'Organic',
    'Hydrocarbons',
    'Alkanes, alkenes, alkynes and aromatic hydrocarbons: preparation, properties, mechanisms',
  ],
  [
    '16',
    'Organic',
    'Organic Compounds Containing Halogens',
    'Preparation, properties and reactions, the C-X bond, substitution mechanisms',
  ],
  [
    '17',
    'Organic',
    'Organic Compounds Containing Oxygen',
    'Alcohols, phenols, ethers, aldehydes, ketones and carboxylic acids',
  ],
  [
    '18',
    'Organic',
    'Organic Compounds Containing Nitrogen',
    'Amines and their basic character, diazonium salts',
  ],
  ['19', 'Organic', 'Biomolecules', 'Carbohydrates, proteins, vitamins, nucleic acids, hormones'],
  [
    '20',
    'Organic',
    'Principles Related to Practical Chemistry',
    'Detecting elements and functional groups, preparing standard compounds, titrations, salt analysis',
  ],
];

const BIOLOGY_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Diversity in Living World',
    'Taxonomy and classification, five-kingdom system, plant and animal kingdoms, viruses and lichens',
  ],
  [
    '2',
    'Structural Organisation in Animals and Plants',
    'Morphology and anatomy of flowering plants, five plant families, animal tissues, organ systems of the frog (brief account)',
  ],
  [
    '3',
    'Cell Structure and Function',
    'Cell theory, prokaryotic and eukaryotic cells, organelles, biomolecules, enzymes, cell division',
  ],
  [
    '4',
    'Plant Physiology',
    'Photosynthesis, respiration in plants, plant growth and development, plant hormones',
  ],
  [
    '5',
    'Human Physiology',
    'Breathing, body fluids and circulation, excretion, locomotion, neural control, chemical coordination',
  ],
  [
    '6',
    'Reproduction',
    'Sexual reproduction in flowering plants, human reproduction, reproductive health',
  ],
  [
    '7',
    'Genetics and Evolution',
    'Mendelian inheritance, chromosomes, molecular basis of inheritance, DNA, gene expression, evolution',
  ],
  [
    '8',
    'Biology and Human Welfare',
    'Human diseases and pathogens, immunology and vaccines, cancer, HIV, drug abuse, microbes in human welfare',
  ],
  [
    '9',
    'Biotechnology and Its Applications',
    'Recombinant DNA technology, insulin and vaccine production, gene therapy, Bt crops, biosafety',
  ],
  [
    '10',
    'Ecology and Environment',
    'Population interactions, ecosystems, energy flow, ecological pyramids, biodiversity and conservation',
  ],
];

const examPattern: ExamContent = {
  lede: 'One paper, on paper: 180 questions in three hours, marked +4 for a right answer and −1 for a wrong one.',
  source: BULLETIN,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'The paper at a glance',
      blocks: [
        {
          kind: 'table',
          caption: 'NEET (UG) questions and marks by subject',
          head: ['Subject', 'Questions', 'Marks'],
          rows: [
            ['Physics', '45', '180'],
            ['Chemistry', '45', '180'],
            ['Biology (Botany and Zoology)', '90', '360'],
          ],
          foot: ['Total', '180', '720'],
          note: 'All 180 questions are compulsory. There are no optional questions.',
        },
        {
          kind: 'text',
          text: 'Every question is multiple choice with four options and one correct or best answer. Biology carries half the paper’s marks, as much as Physics and Chemistry put together.',
        },
      ],
    },
    {
      title: 'How the exam is held',
      blocks: [
        {
          kind: 'table',
          caption: 'Format of the NEET (UG) exam',
          head: ['', 'NEET (UG) 2026'],
          rows: [
            ['Mode', 'Pen and paper (OMR sheet), not computer-based'],
            ['Sittings', 'One day, one shift'],
            ['Duration', '3 hours (2:00 PM to 5:00 PM in 2026)'],
            [
              'Extra time',
              'One extra hour for PwD/PwBD candidates with a physical limitation to write, whether or not they use a scribe',
            ],
          ],
        },
        {
          kind: 'text',
          text: 'Because everyone sits the same paper at the same time, there is no normalisation between shifts. Your raw marks out of 720 are your score.',
        },
      ],
    },
    {
      title: 'Marking scheme',
      blocks: [
        {
          kind: 'table',
          caption: 'Marks for each kind of answer',
          head: ['Your answer', 'Marks'],
          rows: [
            ['Correct, or the most appropriate option', '+4'],
            ['Wrong', '−1'],
            ['Left blank', '0'],
          ],
        },
        {
          kind: 'list',
          items: [
            'If more than one option turns out to be correct, +4 goes to everyone who marked any of the correct options.',
            'If all four options are correct, everyone who attempted the question gets +4.',
            'If no option is correct, or the question is wrong or dropped, every candidate gets +4, attempted or not.',
          ],
        },
        {
          kind: 'text',
          text: 'A wrong answer costs a quarter of what a right one earns. On average, a pure guess among four options is worth +0.25 marks; ruling out one option raises that to about +0.67, and ruling out two to +1.5. Each single guess is still a gamble, so a blank is the safe choice only when you cannot rule anything out.',
        },
      ],
    },
    {
      title: 'Languages',
      blocks: [
        {
          kind: 'text',
          text: 'The paper is offered in 13 languages: English, Hindi, Assamese, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu and Urdu. You choose one in the application form and cannot change it later.',
        },
        {
          kind: 'list',
          items: [
            'English: the booklet is in English only.',
            'Hindi: a bilingual booklet in English and Hindi.',
            'Any other language: a booklet in English plus that language. Regional languages are offered only at centres in the matching states, except Urdu, which is offered across India.',
            'If a translation is unclear, the English version is final.',
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
            'Minimum age: 17 years on or before 31 December of the exam year. For NEET (UG) 2026 that meant born on or before 31.12.2009.',
            'Upper age limit: none.',
            'Qualification: Class 12 or equivalent with Physics, Chemistry, Biology/Biotechnology and English, including practicals. Students still waiting for Class 12 results can sit the exam, but must have passed by the first round of counselling.',
            'Indian citizens and OCI cardholders who want to study medicine abroad also need to qualify NEET (UG).',
          ],
        },
        {
          kind: 'text',
          text: 'The bulletin lists seven accepted qualifying routes (codes 01 to 07), from Class 12 to a B.Sc. with two of Physics, Chemistry and Biology. The official PDF has the exact wording of each.',
        },
      ],
    },
    {
      title: 'Qualifying for admission',
      blocks: [
        {
          kind: 'table',
          caption: 'Minimum NEET (UG) percentile needed for admission',
          head: ['Category', 'Minimum percentile'],
          rows: [
            ['General, General-EWS', '50th'],
            ['SC, ST, OBC', '40th'],
            ['PwBD (General, General-EWS)', '45th'],
            ['PwBD (SC, ST, OBC-NCL)', '40th'],
          ],
          note: 'Percentiles are worked out from the highest marks in the all-India merit list. The Central Government can lower them for a year if too few candidates qualify.',
        },
        {
          kind: 'text',
          text: 'Qualifying is not the same as getting a seat. It makes you eligible for counselling, where seats are allotted by All India Rank.',
        },
      ],
    },
    {
      title: 'If two candidates tie',
      blocks: [
        {
          kind: 'list',
          items: [
            'Higher marks in Biology, then Chemistry, then Physics.',
            'Then fewer wrong answers relative to right ones: across the whole paper, then in Biology, Chemistry and Physics in turn.',
            'If a tie still remains, it is broken by a random process overseen by an independent expert committee.',
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many questions are there in NEET (UG)?',
      answer:
        '180, all compulsory: 45 in Physics, 45 in Chemistry and 90 in Biology. The paper is out of 720.',
    },
    {
      question: 'Is there negative marking in NEET (UG)?',
      answer:
        'Yes. A correct answer earns 4 marks and a wrong answer loses 1. Unanswered questions score 0.',
    },
    {
      question: 'Is NEET (UG) held online or offline?',
      answer:
        'Offline. NEET (UG) 2026 was a pen-and-paper exam on an OMR sheet, in a single shift on one day.',
    },
    {
      question: 'Is there an upper age limit for NEET (UG)?',
      answer:
        'No. The National Medical Commission has set no upper age limit. The minimum age is 17 by 31 December of the exam year.',
    },
  ],
};

const syllabus: ExamContent = {
  lede: 'What NEET (UG) tests, unit by unit: 20 units in Physics, 20 in Chemistry and 10 in Biology, as set by the National Medical Commission.',
  source: SYLLABUS,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'The syllabus at a glance',
      blocks: [
        {
          kind: 'table',
          caption: 'NEET (UG) syllabus units by subject',
          head: ['Subject', 'Units', 'Questions in the paper'],
          rows: [
            ['Physics', '20', '45'],
            ['Chemistry', '20', '45'],
            ['Biology', '10', '90'],
          ],
          foot: ['Total', '50', '180'],
        },
        {
          kind: 'text',
          text: 'The syllabus is notified by the National Medical Commission, not by NTA. It gives units and topics but no marks or number of questions per unit, so this page does not either. Any chapter-wise weightage you see elsewhere is someone’s count from past papers.',
        },
      ],
    },
    {
      title: 'Physics',
      blocks: [
        {
          kind: 'table',
          caption: 'NEET (UG) Physics units',
          head: ['Unit', 'Name', 'What it covers'],
          rows: PHYSICS_UNITS,
        },
      ],
    },
    {
      title: 'Chemistry',
      blocks: [
        {
          kind: 'text',
          text: 'Chemistry is split three ways: 8 units of Physical, 4 of Inorganic and 8 of Organic Chemistry.',
        },
        {
          kind: 'table',
          caption: 'NEET (UG) Chemistry units',
          head: ['Unit', 'Branch', 'Name', 'What it covers'],
          rows: CHEMISTRY_UNITS,
        },
      ],
    },
    {
      title: 'Biology',
      blocks: [
        {
          kind: 'table',
          caption: 'NEET (UG) Biology units',
          head: ['Unit', 'Name', 'What it covers'],
          rows: BIOLOGY_UNITS,
          note: 'Biology is one subject in the syllabus but appears in the paper as Botany and Zoology, 90 questions in all.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'Who sets the NEET (UG) syllabus?',
      answer:
        'The National Medical Commission. NTA conducts the exam and reproduces the NMC syllabus in its information bulletin.',
    },
    {
      question: 'How many units are in the NEET (UG) syllabus?',
      answer: '50: 20 in Physics, 20 in Chemistry and 10 in Biology.',
    },
    {
      question: 'Does the NEET syllabus give chapter-wise weightage?',
      answer:
        'No. It lists units and topics only. Weightage tables found elsewhere are counts from past papers, not official figures.',
    },
    {
      question: 'Are practicals part of the NEET (UG) syllabus?',
      answer:
        'Yes. Physics Unit 20 (Experimental Skills) and Chemistry Unit 20 (Principles Related to Practical Chemistry) are built on standard school lab work.',
    },
  ],
};

export const NEET_UG_CONTENT: ExamContentSet = {
  'exam-pattern': examPattern,
  syllabus,
};
