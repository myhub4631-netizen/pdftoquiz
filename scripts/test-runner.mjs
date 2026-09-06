/**
 * QuestionForge AI — Integration & Unit Test Runner
 * Comprehensive test suite validating:
 * 1. AES-256-GCM Encryption & API Key Masking
 * 2. NEET/JEE Question Boundary & Regex Segmentation
 * 3. Sharp Image Processing & WebP Compression
 * 4. FULL 180-Question & 200-Question NEET Permutation & Subject Routing Benchmark
 */

import crypto from 'crypto';
import ExcelJS from 'exceljs';
import sharp from 'sharp';

// Comprehensive scientific vocabulary dictionaries for statistical classification
const PHYSICS_KEYWORDS = new Set([
  'velocity', 'acceleration', 'force', 'mass', 'friction', 'torque', 'momentum',
  'gravity', 'gravitation', 'kinetic', 'potential', 'energy', 'work', 'power',
  'electric', 'magnetic', 'charge', 'coulomb', 'current', 'voltage', 'resistance',
  'resistor', 'capacitance', 'capacitor', 'inductance', 'inductor', 'circuit',
  'magnetic field', 'lorentz', 'flux', 'solenoid', 'optics', 'lens', 'mirror',
  'refraction', 'reflection', 'wavelength', 'frequency', 'photon', 'interference',
  'diffraction', 'thermodynamics', 'carnot', 'isothermal', 'adiabatic', 'entropy',
  'specific heat', 'oscillation', 'pendulum', 'shm', 'wave', 'doppler', 'resonance',
  'dimension', 'vector', 'modulus', 'youngs', 'stress', 'strain', 'viscosity',
  'bernoulli', 'surface tension', 'radioactivity', 'half life', 'nucleus', 'bohr',
  'semiconductor', 'diode', 'transistor', 'logic gate', 'p-n junction', 'meter bridge',
  'potentiometer', 'galvanometer', 'ammeter', 'voltmeter', 'prism', 'focal length'
]);

const CHEMISTRY_KEYWORDS = new Set([
  'mole', 'molarity', 'molality', 'normality', 'atomic', 'orbital', 'quantum',
  'hybridization', 'sp3', 'sp2', 'resonance', 'lewis', 'electronegativity',
  'ionization', 'periodic', 's-block', 'p-block', 'd-block', 'f-block', 'lanthanoid',
  'actinoid', 'coordination', 'ligand', 'isomers', 'isomerism', 'enantiomer',
  'iupac', 'alkane', 'alkene', 'alkyne', 'benzene', 'aromatic', 'alcohol', 'phenol',
  'ether', 'aldehyde', 'ketone', 'carboxylic', 'amine', 'diazonium', 'polymer',
  'monomer', 'biomolecules', 'carbohydrate', 'glucose', 'peptide', 'amino acid',
  'thermodynamics', 'enthalpy', 'gibbs', 'spontaneous', 'equilibrium', 'le chatelier',
  'ph', 'buffer', 'solubility product', 'redox', 'oxidation', 'reduction', 'anode',
  'cathode', 'galvanic', 'nernst', 'conductance', 'activation energy', 'arrhenius',
  'rate constant', 'first order', 'colloid', 'adsorption', 'catalyst', 'solid state',
  'crystal', 'solution', 'colligative', 'osmotic', 'raoult'
]);

const BIOLOGY_KEYWORDS = new Set([
  'cell', 'membrane', 'mitochondria', 'chloroplast', 'ribosome', 'nucleus', 'endoplasmic',
  'golgi', 'vacuole', 'mitosis', 'meiosis', 'prophase', 'metaphase', 'anaphase', 'telophase',
  'photosynthesis', 'calvin', 'chlorophyll', 'rubisco', 'respiration', 'krebs', 'glycolysis',
  'atp synthase', 'xylem', 'phloem', 'transpiration', 'stomata', 'plant hormone', 'auxin',
  'gibberellin', 'cytokinin', 'ethylene', 'abscisic', 'angiosperm', 'gymnosperm', 'algae',
  'fungi', 'bryophyte', 'pteridophyte', 'root', 'stem', 'leaf', 'flower', 'ovary', 'pollen',
  'embryo', 'endosperm', 'dna', 'rna', 'transcription', 'translation', 'replication',
  'genetics', 'mendel', 'allele', 'heterozygous', 'homozygous', 'chromosome', 'mutation',
  'evolution', 'darwin', 'homologous', 'analogous', 'digestive', 'stomach', 'intestine',
  'circulatory', 'heart', 'hemoglobin', 'erythrocyte', 'leukocyte', 'blood group', 'respiratory',
  'alveoli', 'lungs', 'excretory', 'nephron', 'kidney', 'glomerulus', 'nervous', 'neuron',
  'synapse', 'axon', 'dendrite', 'endocrine', 'pituitary', 'thyroid', 'insulin', 'reproductive',
  'testis', 'sperm', 'ovum', 'fertilization', 'placenta', 'menstrual', 'immune', 'antibody',
  'antigen', 'pathogen', 'bacteria', 'virus', 'ecosystem', 'biome', 'biodiversity', 'population'
]);

const BOTANY_KEYWORDS = new Set([
  'photosynthesis', 'calvin', 'chloroplast', 'chlorophyll', 'rubisco', 'grana', 'stroma',
  'xylem', 'phloem', 'transpiration', 'stomata', 'plant hormone', 'auxin', 'gibberellin',
  'cytokinin', 'ethylene', 'abscisic', 'angiosperm', 'gymnosperm', 'algae', 'fungi',
  'bryophyte', 'pteridophyte', 'root', 'stem', 'leaf', 'flower', 'ovary', 'pollen',
  'anther', 'stigma', 'embryo', 'endosperm', 'monocot', 'dicot', 'plant growth',
  'photoperiodism', 'vernalization', 'apoplast', 'symplast', 'guttation'
]);

const ZOOLOGY_KEYWORDS = new Set([
  'digestive', 'stomach', 'intestine', 'circulatory', 'heart', 'hemoglobin', 'erythrocyte',
  'leukocyte', 'blood group', 'respiratory', 'alveoli', 'lungs', 'excretory', 'nephron',
  'kidney', 'glomerulus', 'nervous', 'neuron', 'synapse', 'axon', 'dendrite', 'endocrine',
  'pituitary', 'thyroid', 'insulin', 'glucagon', 'reproductive', 'testis', 'sperm',
  'ovum', 'fertilization', 'placenta', 'menstrual', 'immune', 'antibody', 'antigen',
  'pathogen', 'chordata', 'arthropoda', 'mollusca', 'annelida', 'evolution', 'darwin',
  'homologous', 'analogous', 'bone', 'muscle', 'sarcomere', 'myosin', 'actin'
]);

const GENERAL_BIO_KEYWORDS = new Set([
  'cell', 'membrane', 'mitochondria', 'ribosome', 'nucleus', 'endoplasmic', 'golgi',
  'vacuole', 'mitosis', 'meiosis', 'prophase', 'metaphase', 'anaphase', 'telophase',
  'dna', 'rna', 'transcription', 'translation', 'replication', 'genetics', 'mendel',
  'allele', 'heterozygous', 'homozygous', 'chromosome', 'mutation', 'bacteria',
  'virus', 'ecosystem', 'biome', 'biodiversity', 'population', 'biotechnology', 'plasmid'
]);

class NEETSubjectDetector {
  static scoreTextContent(text) {
    const tokens = text.toLowerCase().match(/\b[a-z0-9-]{3,}\b/g) || [];
    let pScore = 0;
    let cScore = 0;
    let botScore = 0;
    let zooScore = 0;
    let genBioScore = 0;

    for (const token of tokens) {
      if (PHYSICS_KEYWORDS.has(token)) pScore += 1;
      if (CHEMISTRY_KEYWORDS.has(token)) cScore += 1;
      if (BOTANY_KEYWORDS.has(token)) botScore += 1.5;
      if (ZOOLOGY_KEYWORDS.has(token)) zooScore += 1.5;
      if (GENERAL_BIO_KEYWORDS.has(token)) genBioScore += 1;
    }

    const bScore = botScore + zooScore + genBioScore;

    let dominant = 'Physics';
    if (cScore > pScore && cScore > bScore) {
      dominant = 'Chemistry';
    } else if (bScore > pScore && bScore > cScore) {
      if (botScore > zooScore) dominant = 'Botany';
      else if (zooScore > botScore) dominant = 'Zoology';
      else dominant = 'Biology';
    }

    return { physics: pScore, chemistry: cScore, biology: bScore, botany: botScore, zoology: zooScore, dominant };
  }

  static analyzePaperStructure(fullText, detectedTotalQuestions = 200, examType = 'NEET') {
    const is180 = detectedTotalQuestions <= 185 && detectedTotalQuestions >= 170;
    const is200 = detectedTotalQuestions > 185 || examType === 'NEET';
    const totalQuestions = is180 ? 180 : (is200 ? 200 : detectedTotalQuestions);
    const format = is180 ? 'NEET_180' : 'NEET_200';
    const blockSize = is180 ? 45 : 50;

    const chunks = [
      { blockIndex: 0, start: 1, end: blockSize, sampleText: '' },
      { blockIndex: 1, start: blockSize + 1, end: blockSize * 2, sampleText: '' },
      { blockIndex: 2, start: blockSize * 2 + 1, end: blockSize * 3, sampleText: '' },
      { blockIndex: 3, start: blockSize * 3 + 1, end: totalQuestions, sampleText: '' },
    ];

    const qRegex = /(?:^|\n)\s*(?:Q(?:uestion)?[\s.:-]*|#\s*)?(\d{1,3})[\s.:\)-]+(?=[A-Z0-9\(\[\{\"'`\+\-~✓])/gim;
    const qPositions = [];
    let qm;
    while ((qm = qRegex.exec(fullText)) !== null) {
      const qNum = parseInt(qm[1], 10);
      if (qNum > 0 && qNum <= 300) {
        qPositions.push({ qNum, index: qm.index });
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const relevantMatches = qPositions.filter((p) => p.qNum >= chunk.start && p.qNum <= chunk.end);
      if (relevantMatches.length > 0) {
        const firstIdx = relevantMatches[0].index;
        const subsequentMatches = qPositions.filter((p) => p.qNum > chunk.end);
        const lastIdx = subsequentMatches.length > 0 ? subsequentMatches[0].index : fullText.length;
        chunk.sampleText = fullText.slice(firstIdx, lastIdx);
      }
    }

    const assignedSubjects = [];
    const usedSubjects = new Set();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const scores = this.scoreTextContent(chunk.sampleText);
      let chosen = 'Physics';

      if (scores.dominant === 'Physics' && !usedSubjects.has('Physics')) {
        chosen = 'Physics';
      } else if (scores.dominant === 'Chemistry' && !usedSubjects.has('Chemistry')) {
        chosen = 'Chemistry';
      } else if (scores.dominant === 'Botany' && !usedSubjects.has('Botany')) {
        chosen = 'Botany';
      } else if (scores.dominant === 'Zoology' && !usedSubjects.has('Zoology')) {
        chosen = 'Zoology';
      } else if (scores.dominant === 'Biology') {
        if (!usedSubjects.has('Botany')) chosen = 'Botany';
        else if (!usedSubjects.has('Zoology')) chosen = 'Zoology';
      } else {
        const available = ['Physics', 'Chemistry', 'Botany', 'Zoology'].filter((s) => !usedSubjects.has(s));
        if (available.length > 0) {
          if (available.includes('Physics') && scores.physics >= scores.chemistry && scores.physics >= scores.biology) {
            chosen = 'Physics';
          } else if (available.includes('Chemistry') && scores.chemistry >= scores.physics && scores.chemistry >= scores.biology) {
            chosen = 'Chemistry';
          } else if (available.includes('Botany')) {
            chosen = 'Botany';
          } else if (available.includes('Zoology')) {
            chosen = 'Zoology';
          } else {
            chosen = available[0];
          }
        }
      }

      usedSubjects.add(chosen);
      assignedSubjects.push(chosen);
    }

    const finalSubjects = [...assignedSubjects];
    const allExpected = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
    const missing = allExpected.filter((s) => !finalSubjects.includes(s));

    for (let i = 0; i < 4; i++) {
      if (!finalSubjects[i] || finalSubjects.filter((s, idx) => idx < i && s === finalSubjects[i]).length > 0) {
        if (missing.length > 0) {
          finalSubjects[i] = missing.shift();
        }
      }
    }

    if (finalSubjects.length < 4) {
      finalSubjects[0] = 'Physics';
      finalSubjects[1] = 'Chemistry';
      finalSubjects[2] = 'Botany';
      finalSubjects[3] = 'Zoology';
    }

    const subjectRanges = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const subj = finalSubjects[idx];

      if (is200) {
        subjectRanges.push({
          subject: subj,
          startQ: chunk.start,
          endQ: chunk.start + 34,
          section: 'Section A',
        });
        subjectRanges.push({
          subject: subj,
          startQ: chunk.start + 35,
          endQ: chunk.end,
          section: 'Section B',
        });
      } else {
        subjectRanges.push({
          subject: subj,
          startQ: chunk.start,
          endQ: chunk.end,
        });
      }
    }

    const orderSummary = finalSubjects.join(' ➔ ');
    return { format, totalQuestions, subjectRanges, detectedOrderSummary: orderSummary };
  }

  static getSubjectForQuestion(qNum, structure, questionText) {
    if (questionText && questionText.length > 30) {
      const scores = this.scoreTextContent(questionText);
      const totalScore = scores.physics + scores.chemistry + scores.biology;
      if (totalScore >= 3) {
        const topScore = Math.max(scores.physics, scores.chemistry, scores.biology);
        if (topScore >= 2 && topScore / totalScore > 0.7) {
          return scores.dominant;
        }
      }
    }

    for (const range of structure.subjectRanges) {
      if (qNum >= range.startQ && qNum <= range.endQ) {
        return range.subject;
      }
    }

    if (qNum <= 50) return 'Physics';
    if (qNum <= 100) return 'Chemistry';
    if (qNum <= 150) return 'Botany';
    return 'Zoology';
  }
}

console.log('================================================================');
console.log('🧪 RUNNING QUESTIONFORGE AI COMPREHENSIVE TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// TEST 1: Secret Key AES-256-GCM Encryption & Masking
// -------------------------------------------------------------
console.log('--- TEST 1: Encryption & API Key Masking ---');
const secretKey = 'sk-or-v1-993847291847281903487192837491827391827391827391-9X2K';
const ENCRYPTION_KEY = crypto.createHash('sha256').update('test-secret-salt-2026').digest();
const ALGORITHM = 'aes-256-gcm';

function encryptSecret(plain) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let enc = cipher.update(plain, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

function decryptSecret(encrypted) {
  const [ivHex, tagHex, dataHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(dataHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function maskApiKey(key) {
  if (!key || key.length < 8) return '••••••••';
  const prefix = key.slice(0, 8);
  const suffix = key.slice(-4);
  return `${prefix}${'•'.repeat(Math.max(12, key.length - prefix.length - suffix.length))}${suffix}`;
}

const encrypted = encryptSecret(secretKey);
assert(encrypted !== secretKey, 'Encrypted string is distinct from plain text key');
const decrypted = decryptSecret(encrypted);
assert(decrypted === secretKey, 'Decrypted string matches original plain secret');
const masked = maskApiKey(secretKey);
assert(masked.startsWith('sk-or-v1') && masked.endsWith('9X2K'), 'Masked key preserves prefix and suffix');
assert(!masked.includes('9938472918472819'), 'Masked key conceals sensitive central characters');

// -------------------------------------------------------------
// TEST 2: NEET / JEE Question Boundary Detection & Regex
// -------------------------------------------------------------
console.log('\n--- TEST 2: NEET/JEE Regex Boundary Detection ---');
const samplePdfPage = `
1. A uniform magnetic field B exists in a cylindrical region of radius R. What is the induced electric field?
(A) rB/2
(B) R^2B / 2r
(C) Zero
(D) r^2B / R

2. Which of the following complex ions has the highest magnetic moment?
(A) [Co(NH3)6]3+
(B) [FeF6]3-
(C) [Ni(CN)4]2-
(D) [Cr(H2O)6]3+

3. The plant hormone responsible for apical dominance in angiosperms is:
(A) Auxin
(B) Gibberellin
(C) Cytokinin
(D) Abscisic acid
`;

const questionRegex = /(?:^|\n)\s*(?:Q(?:uestion)?[\s.:-]*|#\s*)?(\d{1,3})[\s.:\)-]+(?=[A-Z0-9\(\[\{\"'`\+\-~✓])/gim;
const matches = [];
let m;
while ((m = questionRegex.exec(samplePdfPage)) !== null) {
  matches.push({ qNum: parseInt(m[1], 10), index: m.index });
}
assert(matches.length === 3, `Detected all 3 questions in mock test text (Expected: 3, Got: ${matches.length})`);
assert(matches[0].qNum === 1 && matches[1].qNum === 2 && matches[2].qNum === 3, 'Question numbers correctly indexed');

// -------------------------------------------------------------
// TEST 3: Image Processing & WebP Compression
// -------------------------------------------------------------
console.log('\n--- TEST 3: Sharp Image Optimization ---');
const mockImageBuffer = await sharp({
  create: {
    width: 300,
    height: 200,
    channels: 4,
    background: { r: 59, g: 130, b: 246, alpha: 1 },
  },
})
  .png()
  .toBuffer();

const optimizedBuffer = await sharp(mockImageBuffer).webp({ quality: 80 }).toBuffer();
assert(optimizedBuffer.length > 0, `Image compressed to WebP: ${optimizedBuffer.length} bytes (Original: ${mockImageBuffer.length} bytes)`);
assert(optimizedBuffer.length <= mockImageBuffer.length, 'Optimized WebP size is equal or smaller than original PNG');

// -------------------------------------------------------------
// TEST 4: NEET 180 & 200 SUBJECT PERMUTATION ROUTING
// -------------------------------------------------------------
console.log('\n--- TEST 4: NEET 180 & 200 Question Permutation Routing ---');

// Case 4A: 180 Questions [Physics (1-45) -> Chemistry (46-90) -> Botany (91-135) -> Zoology (136-180)]
const mock180PhysicsFirstText = `
1. Calculate velocity and magnetic force on charged particle with voltage.
46. Determine IUPAC name of the organic isomer and enthalpy change in mole solution.
91. During photosynthesis in plant chloroplasts, Calvin cycle rubisco enzyme and stomata transpiration.
136. In human reproduction and nervous system, the action potential in neuron and heart ventricles.
`;

const structure180 = NEETSubjectDetector.analyzePaperStructure(mock180PhysicsFirstText, 180, 'NEET');
assert(structure180.format === 'NEET_180', 'Detected NEET 180-Question Format');
assert(NEETSubjectDetector.getSubjectForQuestion(10, structure180) === 'Physics', 'Q10 (1-45) mapped to Physics');
assert(NEETSubjectDetector.getSubjectForQuestion(60, structure180) === 'Chemistry', 'Q60 (46-90) mapped to Chemistry');
assert(NEETSubjectDetector.getSubjectForQuestion(110, structure180) === 'Botany', 'Q110 (91-135) mapped to Botany (Biology Part 1)');
assert(NEETSubjectDetector.getSubjectForQuestion(160, structure180) === 'Zoology', 'Q160 (136-180) mapped to Zoology (Biology Part 2)');

// Case 4B: 180 Questions [Biology First: Botany (1-45) -> Zoology (46-90) -> Chemistry (91-135) -> Physics (136-180)]
const mock180BioFirstText = `
1. The xylem and phloem transport in angiosperm plant leaves during photosynthesis and Calvin cycle.
46. Human heart circulatory system, nephron kidney glomerulus and neuron synapse nervous transmission.
91. Molarity of sulfuric acid solution and redox oxidation state in periodic table coordination ligand.
136. Electric current in resistor circuit with capacitor voltage and magnetic flux solenoid inductance.
`;

const structure180BioFirst = NEETSubjectDetector.analyzePaperStructure(mock180BioFirstText, 180, 'NEET');
assert(NEETSubjectDetector.getSubjectForQuestion(20, structure180BioFirst) === 'Botany', '180 Bio-First: Q20 mapped to Botany');
assert(NEETSubjectDetector.getSubjectForQuestion(60, structure180BioFirst) === 'Zoology', '180 Bio-First: Q60 mapped to Zoology');
assert(NEETSubjectDetector.getSubjectForQuestion(110, structure180BioFirst) === 'Chemistry', '180 Bio-First: Q110 mapped to Chemistry');
assert(NEETSubjectDetector.getSubjectForQuestion(150, structure180BioFirst) === 'Physics', '180 Bio-First: Q150 mapped to Physics');

// Case 4C: 200 Questions [50 Physics -> 50 Chemistry -> 50 Botany -> 50 Zoology]
const mock200PaperText = `
1. Projectile motion with velocity v, gravity g, kinetic energy and magnetic field.
51. Enthalpy of reaction, chemical equilibrium constant Kc, and acid buffer molarity.
101. Photosynthesis chloroplast stroma and plant hormone auxin in angiosperm stem leaf.
151. Human circulatory system, heart ventricles, and hemoglobin oxygen binding in blood.
`;

const structure200 = NEETSubjectDetector.analyzePaperStructure(mock200PaperText, 200, 'NEET');
assert(structure200.format === 'NEET_200', 'Detected NEET 200-Question Format (50 Phys + 50 Chem + 100 Bio)');
assert(NEETSubjectDetector.getSubjectForQuestion(25, structure200) === 'Physics', '200 Standard: Q25 (1-50) mapped to Physics');
assert(NEETSubjectDetector.getSubjectForQuestion(75, structure200) === 'Chemistry', '200 Standard: Q75 (51-100) mapped to Chemistry');
assert(NEETSubjectDetector.getSubjectForQuestion(125, structure200) === 'Botany', '200 Standard: Q125 (101-150) mapped to Botany');
assert(NEETSubjectDetector.getSubjectForQuestion(175, structure200) === 'Zoology', '200 Standard: Q175 (151-200) mapped to Zoology');

// Case 4D: 200 Questions [Biology First: 50 Botany (1-50) -> 50 Zoology (51-100) -> 50 Physics (101-150) -> 50 Chemistry (151-200)]
const mock200BioFirstText = `
1. Photosynthesis chloroplast Calvin cycle, rubisco enzyme and stomata transpiration in plant stem.
51. Human heart circulatory system, erythrocyte hemoglobin and kidney nephron glomerulus excretion.
101. Projectile velocity, magnetic field solenoid flux, capacitor capacitance and resistance circuit.
151. Molarity solution, chemical equilibrium, organic aldehyde ketone isomers and periodic coordination.
`;

const structure200BioFirst = NEETSubjectDetector.analyzePaperStructure(mock200BioFirstText, 200, 'NEET');
assert(NEETSubjectDetector.getSubjectForQuestion(25, structure200BioFirst) === 'Botany', '200 Bio-First: Q25 (1-50) mapped to Botany (Biology Part 1)');
assert(NEETSubjectDetector.getSubjectForQuestion(75, structure200BioFirst) === 'Zoology', '200 Bio-First: Q75 (51-100) mapped to Zoology (Biology Part 2)');
assert(NEETSubjectDetector.getSubjectForQuestion(125, structure200BioFirst) === 'Physics', '200 Bio-First: Q125 (101-150) mapped to Physics');
assert(NEETSubjectDetector.getSubjectForQuestion(175, structure200BioFirst) === 'Chemistry', '200 Bio-First: Q175 (151-200) mapped to Chemistry');


// -------------------------------------------------------------
// TEST 5: FULL 200-QUESTION MULTI-SHEET EXCEL COMPILATION
// -------------------------------------------------------------
console.log('\n--- TEST 5: FULL 200-QUESTION MULTI-SHEET EXCEL GENERATION ---');
const startTime = Date.now();

const mock200Questions = [];
for (let qNum = 1; qNum <= 200; qNum++) {
  const subject = NEETSubjectDetector.getSubjectForQuestion(qNum, structure200);
  mock200Questions.push({
    id: `q_${qNum}`,
    question_number: qNum,
    subject: subject,
    chapter: `${subject} Unit ${(qNum % 5) + 1}`,
    question_text: `NEET 2024 Question ${qNum} (${subject}): Calculate the standard value under given conditions.`,
    options: [
      { label: 'A', text: `Option A for Q${qNum}` },
      { label: 'B', text: `Option B for Q${qNum}` },
      { label: 'C', text: `Option C for Q${qNum}` },
      { label: 'D', text: `Option D for Q${qNum}` },
    ],
    answer: ['A', 'B', 'C', 'D'][qNum % 4],
    question_type: 'single_correct',
    difficulty: qNum % 3 === 0 ? 'Hard' : qNum % 2 === 0 ? 'Medium' : 'Easy',
    confidence: 96,
    needs_review: qNum % 50 === 0,
    source_pages: [Math.floor(qNum / 10) + 1],
  });
}

const workbook = new ExcelJS.Workbook();
workbook.creator = 'QuestionForge AI Engine';

const qSheet = workbook.addWorksheet('Questions', { views: [{ state: 'frozen', ySplit: 1 }] });
qSheet.columns = [
  { header: 'Q.No', key: 'question_no', width: 8 },
  { header: 'Subject', key: 'subject', width: 14 },
  { header: 'Chapter', key: 'chapter', width: 18 },
  { header: 'Question Text', key: 'question_text', width: 45 },
  { header: 'Option A', key: 'option_a', width: 25 },
  { header: 'Option B', key: 'option_b', width: 25 },
  { header: 'Option C', key: 'option_c', width: 25 },
  { header: 'Option D', key: 'option_d', width: 25 },
  { header: 'Answer', key: 'answer', width: 10 },
  { header: 'Confidence', key: 'confidence', width: 14 },
];

for (const q of mock200Questions) {
  qSheet.addRow({
    question_no: q.question_number,
    subject: q.subject,
    chapter: q.chapter,
    question_text: q.question_text,
    option_a: q.options[0].text,
    option_b: q.options[1].text,
    option_c: q.options[2].text,
    option_d: q.options[3].text,
    answer: q.answer,
    confidence: `${q.confidence}%`,
  });
}

const metaSheet = workbook.addWorksheet('Metadata');
metaSheet.addRow(['Property', 'Value']);
metaSheet.addRow(['Exam Type', 'NEET UG']);
metaSheet.addRow(['Total Questions', 200]);
metaSheet.addRow(['Physics (50 Questions)', 50]);
metaSheet.addRow(['Chemistry (50 Questions)', 50]);
metaSheet.addRow(['Botany (50 Questions)', 50]);
metaSheet.addRow(['Zoology (50 Questions)', 50]);

const repSheet = workbook.addWorksheet('Extraction Report');
repSheet.addRow(['Q.No', 'Subject', 'Status']);
for (const q of mock200Questions) {
  repSheet.addRow([q.question_number, q.subject, q.needs_review ? 'NEEDS_REVIEW' : 'VERIFIED']);
}

const xlsxBuffer = await workbook.xlsx.writeBuffer();
const elapsed = Date.now() - startTime;

assert(xlsxBuffer.length > 20000, `Generated 200-question Excel workbook (${(xlsxBuffer.length / 1024).toFixed(1)} KB)`);
assert(qSheet.rowCount === 201, `Questions sheet contains exactly 200 question rows + 1 header`);
assert(elapsed < 2000, `200-question Excel compiled in ${elapsed}ms (< 2000ms target)`);

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
