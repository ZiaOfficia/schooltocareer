import type { ExamContent, ExamContentSet } from './types';

/**
 * JEE MAIN — exam pattern and syllabus.
 *
 * Written from two NTA documents, both linked from jeemain.nta.nic.in and both
 * read in full for this file:
 *
 *   Information Bulletin, JEE (Main) 2026 — Chapter 2, Examination Scheme
 *   Syllabus for JEE (Main) 2026
 *
 * Every number in a table below is in one of those two documents. The "what it
 * covers" column of the syllabus tables is a shortened reading of NTA's own
 * topic list for that unit: it leaves topics out for length, it never adds one.
 *
 * When NTA publishes the 2027 bulletin, re-read Chapter 2 against this file
 * before changing `checkedOn` — the 2021-2024 pattern (10 numerical questions,
 * answer any 5) is the kind of change that arrives without an announcement.
 */

const BULLETIN = {
  name: 'JEE (Main) 2026 Information Bulletin',
  url: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/11/202511021649722475.pdf',
  publishedBy: 'National Testing Agency',
} as const;

const SYLLABUS = {
  name: 'Syllabus for JEE (Main) 2026',
  url: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf',
  publishedBy: 'National Testing Agency',
} as const;

const CYCLE_NOTE =
  'This is the 2026 edition, the latest one NTA has published. When the 2027 edition comes out we will check this page against it.';

const MATHS_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Sets, Relations and Functions',
    'Sets and operations on them, power set, types of relations, one-one, into and onto functions, composition of functions',
  ],
  [
    '2',
    'Complex Numbers and Quadratic Equations',
    'The a + ib form, Argand diagram, modulus and argument, quadratic equations, roots and coefficients, nature of roots',
  ],
  [
    '3',
    'Matrices and Determinants',
    'Types and algebra of matrices, determinants of order two and three, adjoint and inverse, solving linear equations in two or three variables',
  ],
  [
    '4',
    'Permutations and Combinations',
    'Fundamental principle of counting, P(n, r) and C(n, r), simple applications',
  ],
  [
    '5',
    'Binomial Theorem',
    'Binomial theorem for a positive integral index, general term and middle term',
  ],
  [
    '6',
    'Sequence and Series',
    'Arithmetic and geometric progressions, inserting means, relation between A.M. and G.M.',
  ],
  [
    '7',
    'Limit, Continuity and Differentiability',
    'Functions and their graphs, limits, continuity, differentiation, derivatives up to order two, rate of change, maxima and minima',
  ],
  [
    '8',
    'Integral Calculus',
    'Integration by substitution, by parts and by partial fractions, definite integrals and their properties, area under simple curves',
  ],
  [
    '9',
    'Differential Equations',
    'Order and degree, separation of variables, homogeneous and linear differential equations',
  ],
  [
    '10',
    'Co-ordinate Geometry',
    'Distance and section formulae, straight lines, circles, parabola, ellipse and hyperbola in standard form',
  ],
  [
    '11',
    'Three Dimensional Geometry',
    'Points in space, direction ratios and cosines, equation of a line, skew lines and the shortest distance between them',
  ],
  [
    '12',
    'Vector Algebra',
    'Vectors and scalars, addition, components in two and three dimensions, scalar and vector products',
  ],
  [
    '13',
    'Statistics and Probability',
    'Mean, median, mode, standard deviation, variance, mean deviation, addition and multiplication theorems, Bayes’ theorem',
  ],
  [
    '14',
    'Trigonometry',
    'Trigonometric identities and functions, inverse trigonometric functions and their properties',
  ],
];

const PHYSICS_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Units and Measurements',
    'SI units, least count, significant figures, errors, dimensional analysis',
  ],
  [
    '2',
    'Kinematics',
    'Motion in a straight line, motion graphs, relative velocity, projectile motion, uniform circular motion',
  ],
  [
    '3',
    'Laws of Motion',
    'Newton’s laws, momentum and impulse, friction, circular motion on level and banked roads',
  ],
  [
    '4',
    'Work, Energy and Power',
    'Work-energy theorem, kinetic and potential energy, conservation of mechanical energy, collisions',
  ],
  [
    '5',
    'Rotational Motion',
    'Centre of mass, torque, angular momentum, moment of inertia, parallel and perpendicular axes theorems',
  ],
  [
    '6',
    'Gravitation',
    'Law of gravitation, change in g with height and depth, Kepler’s laws, escape velocity, satellites',
  ],
  [
    '7',
    'Properties of Solids and Liquids',
    'Stress and strain, Hooke’s law, fluid pressure, viscosity, Bernoulli’s principle, surface tension, heat and heat transfer',
  ],
  [
    '8',
    'Thermodynamics',
    'Zeroth, first and second laws, isothermal and adiabatic processes, reversible and irreversible processes',
  ],
  [
    '9',
    'Kinetic Theory of Gases',
    'Equation of state, RMS speed, degrees of freedom, equipartition of energy, mean free path',
  ],
  [
    '10',
    'Oscillations and Waves',
    'Simple harmonic motion, spring and pendulum, wave motion, superposition, standing waves, beats',
  ],
  [
    '11',
    'Electrostatics',
    'Coulomb’s law, electric field and dipole, Gauss’s law, electric potential, capacitors, dielectrics',
  ],
  [
    '12',
    'Current Electricity',
    'Drift velocity, Ohm’s law, resistivity, resistors and cells in series and parallel, Kirchhoff’s laws, Wheatstone and metre bridge',
  ],
  [
    '13',
    'Magnetic Effects of Current and Magnetism',
    'Biot-Savart law, Ampere’s law, force on charges and conductors, galvanometer, bar magnet, magnetic materials',
  ],
  [
    '14',
    'Electromagnetic Induction and Alternating Currents',
    'Faraday’s and Lenz’s laws, inductance, LCR series circuit, resonance, AC generator, transformer',
  ],
  [
    '15',
    'Electromagnetic Waves',
    'Displacement current, properties of electromagnetic waves, the electromagnetic spectrum and its uses',
  ],
  [
    '16',
    'Optics',
    'Mirrors, lenses, total internal reflection, prism, microscope and telescope, interference, diffraction, polarisation',
  ],
  [
    '17',
    'Dual Nature of Matter and Radiation',
    'Photoelectric effect, Einstein’s photoelectric equation, de Broglie relation',
  ],
  [
    '18',
    'Atoms and Nuclei',
    'Rutherford and Bohr models, hydrogen spectrum, mass defect, binding energy, fission and fusion',
  ],
  [
    '19',
    'Electronic Devices',
    'Semiconductor diode, rectifier, LED, photodiode, solar cell, Zener diode, logic gates',
  ],
  [
    '20',
    'Experimental Skills',
    'The standard school experiments: Vernier calipers, screw gauge, simple pendulum, Young’s modulus, surface tension, viscosity, resonance tube and others',
  ],
];

const CHEMISTRY_UNITS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Physical',
    'Some Basic Concepts in Chemistry',
    'Laws of chemical combination, mole concept, empirical and molecular formulae, stoichiometry',
  ],
  [
    '2',
    'Physical',
    'Atomic Structure',
    'Bohr model, hydrogen spectrum, de Broglie relation, uncertainty principle, orbitals, Aufbau principle, Hund’s rule',
  ],
  [
    '3',
    'Physical',
    'Chemical Bonding and Molecular Structure',
    'Ionic and covalent bonds, VSEPR theory, valence bond theory, hybridisation, molecular orbital theory, hydrogen bonding',
  ],
  [
    '4',
    'Physical',
    'Chemical Thermodynamics',
    'First law, enthalpy, Hess’s law, second law, spontaneity, Gibbs energy',
  ],
  [
    '5',
    'Physical',
    'Solutions',
    'Ways of expressing concentration, Raoult’s law, colligative properties, van’t Hoff factor',
  ],
  [
    '6',
    'Physical',
    'Equilibrium',
    'Dynamic equilibrium, Le Chatelier’s principle, ionic equilibrium, pH scale, buffer solutions, solubility product',
  ],
  [
    '7',
    'Physical',
    'Redox Reactions and Electrochemistry',
    'Oxidation number, balancing redox reactions, conductance, Kohlrausch’s law, electrochemical cells, Nernst equation',
  ],
  [
    '8',
    'Physical',
    'Chemical Kinetics',
    'Rate of reaction, order and molecularity, zero and first-order reactions, half-life, Arrhenius theory, activation energy',
  ],
  [
    '9',
    'Inorganic',
    'Classification of Elements and Periodicity in Properties',
    'Periodic law, s, p, d and f blocks, trends in radii, ionisation enthalpy, electron gain enthalpy, oxidation states',
  ],
  [
    '10',
    'Inorganic',
    'p-Block Elements',
    'Groups 13 to 18: electronic configuration, general trends, unique behaviour of the first element in each group',
  ],
  [
    '11',
    'Inorganic',
    'd- and f-Block Elements',
    'Transition elements and their trends, K2Cr2O7 and KMnO4, lanthanoids and lanthanoid contraction, actinoids',
  ],
  [
    '12',
    'Inorganic',
    'Coordination Compounds',
    'Werner’s theory, ligands, IUPAC naming, isomerism, valence bond approach, crystal field theory',
  ],
  [
    '13',
    'Organic',
    'Purification and Characterisation of Organic Compounds',
    'Crystallisation, distillation, chromatography, detecting and estimating elements, empirical and molecular formulae',
  ],
  [
    '14',
    'Organic',
    'Some Basic Principles of Organic Chemistry',
    'Hybridisation, functional groups, isomerism, naming, bond fission, electrophiles and nucleophiles, electronic displacement effects',
  ],
  [
    '15',
    'Organic',
    'Hydrocarbons',
    'Alkanes, alkenes, alkynes and aromatic hydrocarbons, with their main reactions and mechanisms',
  ],
  [
    '16',
    'Organic',
    'Organic Compounds Containing Halogens',
    'Preparation, properties and reactions, the C-X bond, substitution mechanisms, chloroform, iodoform, freons and DDT',
  ],
  [
    '17',
    'Organic',
    'Organic Compounds Containing Oxygen',
    'Alcohols, phenols, ethers, aldehydes and ketones, carboxylic acids',
  ],
  [
    '18',
    'Organic',
    'Organic Compounds Containing Nitrogen',
    'Amines and their basic character, diazonium salts',
  ],
  ['19', 'Organic', 'Biomolecules', 'Carbohydrates, proteins, vitamins, nucleic acids'],
  [
    '20',
    'Organic',
    'Principles Related to Practical Chemistry',
    'Detecting elements and functional groups, preparing a few standard compounds, titration exercises',
  ],
];

const examPattern: ExamContent = {
  lede: 'How many questions, how many marks, how long, and what a wrong answer costs. Paper 1 is for B.E./B.Tech, Paper 2A for B.Arch and Paper 2B for B.Planning.',
  source: BULLETIN,
  checkedOn: '2026-10-08',
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'The three papers at a glance',
      blocks: [
        {
          kind: 'table',
          caption: 'JEE Main papers: who they are for and how they are set',
          head: ['Paper', 'For', 'Subjects', 'Questions', 'Marks', 'Time'],
          rows: [
            ['Paper 1', 'B.E./B.Tech', 'Mathematics, Physics, Chemistry', '75', '300', '3 hours'],
            [
              'Paper 2A',
              'B.Arch',
              'Mathematics, Aptitude Test, Drawing Test',
              '77',
              '400',
              '3 hours',
            ],
            [
              'Paper 2B',
              'B.Planning',
              'Mathematics, Aptitude Test, Planning',
              '100',
              '400',
              '3 hours',
            ],
          ],
          note: 'If you take Paper 2A and Paper 2B together, you get 3 hours 30 minutes for both.',
        },
        {
          kind: 'text',
          text: 'All three are computer-based. The one exception is the Drawing Test in Paper 2A, which you do with pencil on an A4 drawing sheet.',
        },
      ],
    },
    {
      title: 'Paper 1: B.E./B.Tech',
      blocks: [
        {
          kind: 'table',
          caption: 'Paper 1 questions and marks by subject',
          head: ['Subject', 'Section A (multiple choice)', 'Section B (numerical)', 'Marks'],
          rows: [
            ['Mathematics', '20', '5', '100'],
            ['Physics', '20', '5', '100'],
            ['Chemistry', '20', '5', '100'],
          ],
          foot: ['Total', '60', '15', '300'],
        },
        {
          kind: 'text',
          text: 'Every subject has two sections. Section A is multiple choice: four options, one answer. Section B has no options. You work out a number and type it in with the on-screen keypad, rounded to the nearest whole number.',
        },
        {
          kind: 'text',
          text: 'All 75 questions count. There is no choice in Section B.',
        },
      ],
    },
    {
      title: 'Marking scheme',
      blocks: [
        {
          kind: 'table',
          caption: 'Marks for each kind of answer',
          head: ['Your answer', 'Multiple choice', 'Numerical'],
          rows: [
            ['Correct', '+4', '+4'],
            ['Wrong', '-1', '-1'],
            ['Left blank, or only marked for review', '0', '0'],
          ],
          note: 'The Drawing Test in Paper 2A is the exception: its two questions are marked out of 100 together and carry no negative marking.',
        },
        {
          kind: 'text',
          text: 'The negative marking on numerical questions is the part students forget. A guess in Section B costs a mark, the same as a wrong option in Section A.',
        },
        {
          kind: 'text',
          text: 'If NTA drops a question, everyone who sat that shift gets the full 4 marks for it.',
        },
      ],
    },
    {
      title: 'Paper 2A: B.Arch',
      blocks: [
        {
          kind: 'table',
          caption: 'Paper 2A questions and marks by part',
          head: ['Part', 'Questions', 'Marks', 'How you answer'],
          rows: [
            [
              'Part I: Mathematics',
              '25 (20 multiple choice, 5 numerical)',
              '100',
              'On the computer',
            ],
            ['Part II: Aptitude Test', '50 multiple choice', '200', 'On the computer'],
            ['Part III: Drawing Test', '2', '100', 'Pencil on an A4 drawing sheet'],
          ],
          foot: ['Total', '77', '400', ''],
        },
      ],
    },
    {
      title: 'Paper 2B: B.Planning',
      blocks: [
        {
          kind: 'table',
          caption: 'Paper 2B questions and marks by part',
          head: ['Part', 'Questions', 'Marks'],
          rows: [
            ['Part I: Mathematics', '25 (20 multiple choice, 5 numerical)', '100'],
            ['Part II: Aptitude Test', '50 multiple choice', '200'],
            ['Part III: Planning', '25 multiple choice', '100'],
          ],
          foot: ['Total', '100', '400'],
          note: 'The whole of Paper 2B is on the computer.',
        },
      ],
    },
    {
      title: 'Language of the paper',
      blocks: [
        {
          kind: 'text',
          text: 'The exam is offered in 13 languages. Apart from English and Hindi, a regional language is available only at centres in the states listed against it.',
        },
        {
          kind: 'table',
          caption: 'Languages and where each is offered',
          head: ['Language', 'Offered at'],
          rows: [
            ['English', 'All centres in India and abroad'],
            ['Hindi', 'All centres in India'],
            ['Urdu', 'All centres in India'],
            ['Assamese', 'Assam'],
            ['Bengali', 'West Bengal, Tripura, Andaman and Nicobar Islands'],
            ['Gujarati', 'Gujarat, Daman and Diu, Dadra and Nagar Haveli'],
            ['Kannada', 'Karnataka'],
            ['Malayalam', 'Kerala, Lakshadweep'],
            ['Marathi', 'Maharashtra'],
            ['Odia', 'Odisha'],
            [
              'Punjabi',
              'Punjab, Chandigarh, Delhi/New Delhi (including Faridabad, Ghaziabad, Gurugram, Noida and Greater Noida)',
            ],
            ['Tamil', 'Tamil Nadu, Puducherry, Andaman and Nicobar Islands'],
            ['Telugu', 'Andhra Pradesh, Telangana'],
          ],
        },
        {
          kind: 'list',
          items: [
            'You choose the language in the application form and cannot change it afterwards.',
            'A paper in any language other than English also shows the English version. If the two differ, the English one is treated as correct.',
          ],
        },
      ],
    },
    {
      title: 'If two students get the same score',
      blocks: [
        {
          kind: 'text',
          text: 'For Paper 1, NTA separates a tie by checking these in order and stopping at the first one that differs:',
        },
        {
          kind: 'list',
          items: [
            'Higher NTA score in Mathematics',
            'Higher NTA score in Physics',
            'Higher NTA score in Chemistry',
            'Fewer wrong answers compared with correct ones, across the whole paper',
            'The same comparison in Mathematics, then Physics, then Chemistry',
          ],
        },
        {
          kind: 'text',
          text: 'If all of these are equal, both students get the same rank.',
        },
      ],
    },
    {
      title: 'Extra time',
      blocks: [
        {
          kind: 'table',
          caption: 'Time allowed, with and without compensatory time',
          head: ['Paper', 'Standard time', 'Candidates eligible for a scribe'],
          rows: [
            ['Paper 1', '3 hours', '4 hours'],
            ['Paper 2A or Paper 2B', '3 hours', '4 hours'],
            ['Paper 2A and 2B together', '3 hours 30 minutes', '4 hours 10 minutes'],
          ],
          note: 'The extra time is 20 minutes for every hour of the exam, for PwD/PwBD candidates who are eligible for a scribe.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many questions are there in JEE Main Paper 1?',
      answer:
        'There are 75 questions for 300 marks: 25 each in Mathematics, Physics and Chemistry. In each subject 20 are multiple choice and 5 are numerical.',
    },
    {
      question: 'Is there negative marking for numerical questions?',
      answer:
        'Yes. A wrong numerical answer costs 1 mark, the same as a wrong multiple-choice answer. Leaving a question blank costs nothing.',
    },
    {
      question: 'Can I skip some of the numerical questions?',
      answer:
        'You can leave any question blank, but there is no built-in choice. Section B has 5 questions per subject and all 5 count, unlike 2021 to 2024 when there were 10 and you answered any 5.',
    },
    {
      question: 'Is the B.Arch drawing test on the computer?',
      answer:
        'No. Mathematics and the Aptitude Test are on the computer, but the Drawing Test is done with pencil on an A4 drawing sheet.',
    },
    {
      question: 'Can I take both Paper 2A and Paper 2B?',
      answer: 'Yes. If you take both, they are held together and you get 3 hours 30 minutes.',
    },
  ],
};

const syllabus: ExamContent = {
  lede: 'Every unit NTA lists for each paper, with what each one covers in a line. Use the tables to tick off what you have finished.',
  source: SYLLABUS,
  checkedOn: '2026-10-08',
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'How big the syllabus is',
      blocks: [
        {
          kind: 'table',
          caption: 'Number of units in each subject of Paper 1',
          head: ['Subject', 'Units', 'Questions in the paper'],
          rows: [
            ['Mathematics', '14', '25'],
            ['Physics', '20', '25'],
            ['Chemistry', '20', '25'],
          ],
          foot: ['Total', '54', '75'],
        },
        {
          kind: 'text',
          text: 'NTA does not say how many questions come from each unit, so this page does not either. The last column of each table below is a short version of NTA’s topic list. The official PDF has every topic in full.',
        },
      ],
    },
    {
      title: 'Mathematics',
      blocks: [
        {
          kind: 'table',
          caption: 'JEE Main Mathematics units',
          head: ['Unit', 'Name', 'What it covers'],
          rows: MATHS_UNITS,
          note: 'The same 14 units are Part I of Paper 2A (B.Arch) and Paper 2B (B.Planning).',
        },
      ],
    },
    {
      title: 'Physics',
      blocks: [
        {
          kind: 'table',
          caption: 'JEE Main Physics units',
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
          text: 'Chemistry is split three ways: 8 units of Physical, 4 of Inorganic and 8 of Organic.',
        },
        {
          kind: 'table',
          caption: 'JEE Main Chemistry units',
          head: ['Unit', 'Branch', 'Name', 'What it covers'],
          rows: CHEMISTRY_UNITS,
        },
      ],
    },
    {
      title: 'Paper 2A: B.Arch',
      blocks: [
        {
          kind: 'table',
          caption: 'Paper 2A syllabus by part',
          head: ['Part', 'What it covers'],
          rows: [
            ['Part I: Mathematics', 'The same 14 units as Paper 1 Mathematics'],
            [
              'Part II: Aptitude Test',
              'Awareness of buildings, materials, objects and textures; picturing a 3D object from 2D drawings and from different sides; analytical reasoning and mental ability; scale and proportion; colour, texture, harmony and contrast; turning shapes into plans, elevations and 3D views',
            ],
            [
              'Part III: Drawing Test',
              'Sketching scenes and activities from memory: city scenes such as markets, festivals, streets and monuments, landscapes such as riverfronts, gardens and trees, and rural life',
            ],
          ],
          note: 'For the Drawing Test NTA asks you to bring your own pencils, geometry box, colour pencils and crayons.',
        },
      ],
    },
    {
      title: 'Paper 2B: B.Planning',
      blocks: [
        {
          kind: 'table',
          caption: 'Paper 2B syllabus by part',
          head: ['Part', 'What it covers'],
          rows: [
            ['Part I: Mathematics', 'The same 14 units as Paper 1 Mathematics'],
            ['Part II: Aptitude Test', 'The same aptitude syllabus as Paper 2A'],
            [
              'Part III: Planning, Unit 1: General Awareness',
              'General knowledge, prominent cities, development issues, government programmes',
            ],
            [
              'Part III: Planning, Unit 2: Social Sciences',
              'Nationalism, colonialism and colonial cities, industrialisation, resources, agriculture, human settlements, power-sharing and federalism, the Constitution of India, economic development, poverty, population, urbanisation, rural development',
            ],
            [
              'Part III: Planning, Unit 3: Thinking Skills',
              'Comprehension of an unseen passage, map reading (scale, distance, direction, area), critical reasoning, reading charts, graphs and tables, basic statistics and quantitative reasoning',
            ],
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many units are there in the JEE Main syllabus?',
      answer: 'Paper 1 has 54 units: 14 in Mathematics, 20 in Physics and 20 in Chemistry.',
    },
    {
      question: 'Is the Mathematics syllabus the same for B.Tech, B.Arch and B.Planning?',
      answer: 'Yes. The same 14 Mathematics units are used for Paper 1, Paper 2A and Paper 2B.',
    },
    {
      question: 'Does NTA publish chapter-wise weightage?',
      answer:
        'No. The syllabus lists units and topics but gives no marks or number of questions per unit. Any weightage table you see elsewhere is someone’s count from past papers, not an NTA figure.',
    },
    {
      question: 'Are practical experiments part of the syllabus?',
      answer:
        'Yes. Physics Unit 20 (Experimental Skills) and Chemistry Unit 20 (Principles Related to Practical Chemistry) are built around standard school lab work.',
    },
  ],
};

export const JEE_MAIN_CONTENT: ExamContentSet = {
  'exam-pattern': examPattern,
  syllabus,
};
