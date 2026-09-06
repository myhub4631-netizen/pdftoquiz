/**
 * NEET Exam Subject Distribution & Permutation Detector
 * 
 * Accurately determines whether a paper is a 180-question or 200-question NEET paper,
 * and dynamically identifies the permutation of subjects regardless of ordering:
 * - 180 Questions: 45 Physics + 45 Chemistry + 90 Biology (or 45 Botany + 45 Zoology)
 * - 200 Questions: 50 Physics + 50 Chemistry + 100 Biology (or 50 Botany + 50 Zoology)
 * 
 * Can dynamically resolve any section permutation:
 * - Physics -> Chemistry -> Biology
 * - Biology -> Chemistry -> Physics
 * - Biology -> Physics -> Chemistry
 * - Physics -> Biology -> Chemistry
 * - Chemistry -> Physics -> Biology
 * - Chemistry -> Biology -> Physics
 */

export interface SubjectRange {
  subject: 'Physics' | 'Chemistry' | 'Biology' | 'Botany' | 'Zoology' | 'Mathematics' | 'General';
  startQ: number;
  endQ: number;
  section?: 'Section A' | 'Section B' | null;
}

export interface NEETPaperStructure {
  format: 'NEET_180' | 'NEET_200' | 'JEE_MAIN_90' | 'GENERAL';
  totalQuestions: number;
  subjectRanges: SubjectRange[];
  detectedOrderSummary: string;
}

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
  'potentiometer', 'galvanometer', 'ammeter', 'voltmeter', 'prism', 'focal length',
  'ray optics', 'wave optics', 'planck', 'photoelectric', 'de broglie'
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
  'crystal', 'solution', 'colligative', 'osmotic', 'raoult', 'electrochemical'
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

export class NEETSubjectDetector {
  /**
   * Scores a text sample against Physics, Chemistry, Botany, and Zoology keyword frequencies.
   */
  static scoreTextContent(text: string): {
    physics: number;
    chemistry: number;
    biology: number;
    botany: number;
    zoology: number;
    dominant: 'Physics' | 'Chemistry' | 'Botany' | 'Zoology' | 'Biology';
  } {
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

    let dominant: 'Physics' | 'Chemistry' | 'Botany' | 'Zoology' | 'Biology' = 'Physics';
    if (cScore > pScore && cScore > bScore) {
      dominant = 'Chemistry';
    } else if (bScore > pScore && bScore > cScore) {
      if (botScore > zooScore) dominant = 'Botany';
      else if (zooScore > botScore) dominant = 'Zoology';
      else dominant = 'Biology';
    }

    return {
      physics: pScore,
      chemistry: cScore,
      biology: bScore,
      botany: botScore,
      zoology: zooScore,
      dominant
    };
  }

  /**
   * Analyzes an entire question paper text and extracts the exact subject sequence and ranges.
   * Seamlessly resolves any permutation of Physics, Chemistry, Botany, and Zoology across
   * 180-question (45 per block) and 200-question (50 per block) papers.
   */
  static analyzePaperStructure(
    fullText: string,
    detectedTotalQuestions: number = 200,
    examType: string = 'NEET'
  ): NEETPaperStructure {
    const is180 = detectedTotalQuestions <= 185 && detectedTotalQuestions >= 170;
    const is200 = detectedTotalQuestions > 185 || examType === 'NEET';

    const totalQuestions = is180 ? 180 : (is200 ? 200 : detectedTotalQuestions);
    const format = is180 ? 'NEET_180' : 'NEET_200';
    const blockSize = is180 ? 45 : 50;

    // 1. Define 4 equal blocks (NEET has 4 subjects: Physics, Chemistry, Botany, Zoology)
    // 180 questions = 45 x 4
    // 200 questions = 50 x 4
    const chunks: Array<{
      blockIndex: number;
      start: number;
      end: number;
      sampleText: string;
      explicitHeaderSubject?: 'Physics' | 'Chemistry' | 'Botany' | 'Zoology';
    }> = [
      { blockIndex: 0, start: 1, end: blockSize, sampleText: '' },
      { blockIndex: 1, start: blockSize + 1, end: blockSize * 2, sampleText: '' },
      { blockIndex: 2, start: blockSize * 2 + 1, end: blockSize * 3, sampleText: '' },
      { blockIndex: 3, start: blockSize * 3 + 1, end: totalQuestions, sampleText: '' },
    ];

    // 2. Extract question positions in text
    const qRegex = /(?:^|\n)\s*(?:Q(?:uestion)?[\s.:-]*|#\s*)?(\d{1,3})[\s.:\)-]+(?=[A-Z0-9\(\[\{\"'`\+\-~✓])/gim;
    const qPositions: Array<{ qNum: number; index: number }> = [];
    let qm;
    while ((qm = qRegex.exec(fullText)) !== null) {
      const qNum = parseInt(qm[1], 10);
      if (qNum > 0 && qNum <= 300) {
        qPositions.push({ qNum, index: qm.index });
      }
    }

    // 3. Search for explicit subject headers near question boundaries
    const headerRegex = /(?:^|\n|\s{2,})(?:PART|SECTION)?\s*[-–:]*\s*(PHYSICS|CHEMISTRY|BOTANY|ZOOLOGY|BIOLOGY)\b/gi;
    let hm;
    while ((hm = headerRegex.exec(fullText)) !== null) {
      const rawHeader = hm[1].toUpperCase();
      const headerIdx = hm.index;
      // Find nearest following question number
      const nextQ = qPositions.find((p) => p.index >= headerIdx);
      if (nextQ) {
        for (const chunk of chunks) {
          if (nextQ.qNum >= chunk.start && nextQ.qNum <= chunk.start + 5) {
            if (rawHeader === 'PHYSICS') chunk.explicitHeaderSubject = 'Physics';
            else if (rawHeader === 'CHEMISTRY') chunk.explicitHeaderSubject = 'Chemistry';
            else if (rawHeader === 'BOTANY') chunk.explicitHeaderSubject = 'Botany';
            else if (rawHeader === 'ZOOLOGY') chunk.explicitHeaderSubject = 'Zoology';
            else if (rawHeader === 'BIOLOGY') chunk.explicitHeaderSubject = 'Botany'; // Bio first block is Botany
          }
        }
      }
    }

    // 4. Sample text for each of the 4 blocks strictly within their question boundaries
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const relevantMatches = qPositions.filter((p) => p.qNum >= chunk.start && p.qNum <= chunk.end);
      if (relevantMatches.length > 0) {
        const firstIdx = relevantMatches[0].index;
        // Find next chunk start position to prevent text bleeding across subject sections
        const subsequentMatches = qPositions.filter((p) => p.qNum > chunk.end);
        const lastIdx = subsequentMatches.length > 0 ? subsequentMatches[0].index : fullText.length;
        chunk.sampleText = fullText.slice(firstIdx, lastIdx);
      }
    }

    // 5. Classify each block
    const assignedSubjects: Array<'Physics' | 'Chemistry' | 'Botany' | 'Zoology'> = [];
    const usedSubjects = new Set<'Physics' | 'Chemistry' | 'Botany' | 'Zoology'>();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (chunk.explicitHeaderSubject && !usedSubjects.has(chunk.explicitHeaderSubject)) {
        assignedSubjects.push(chunk.explicitHeaderSubject);
        usedSubjects.add(chunk.explicitHeaderSubject);
        continue;
      }

      const scores = this.scoreTextContent(chunk.sampleText);
      let chosen: 'Physics' | 'Chemistry' | 'Botany' | 'Zoology' = 'Physics';

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
        // Find best unused match
        const available = (['Physics', 'Chemistry', 'Botany', 'Zoology'] as const).filter((s) => !usedSubjects.has(s));
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

    // Ensure all 4 subjects are present without duplicates
    const finalSubjects: Array<'Physics' | 'Chemistry' | 'Botany' | 'Zoology'> = [...assignedSubjects];
    const allExpected: Array<'Physics' | 'Chemistry' | 'Botany' | 'Zoology'> = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
    const missing = allExpected.filter((s) => !finalSubjects.includes(s));

    for (let i = 0; i < 4; i++) {
      if (!finalSubjects[i] || finalSubjects.filter((s, idx) => idx < i && s === finalSubjects[i]).length > 0) {
        if (missing.length > 0) {
          finalSubjects[i] = missing.shift()!;
        }
      }
    }

    // Fallback if sampling was completely empty
    if (finalSubjects.length < 4) {
      finalSubjects[0] = 'Physics';
      finalSubjects[1] = 'Chemistry';
      finalSubjects[2] = 'Botany';
      finalSubjects[3] = 'Zoology';
    }

    // 6. Build granular subject ranges (including Section A / Section B for 200 questions)
    const subjectRanges: SubjectRange[] = [];

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const subj = finalSubjects[idx];

      if (is200) {
        // In 200 questions, each subject has 35 in Section A and 15 in Section B
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

    return {
      format,
      totalQuestions,
      subjectRanges,
      detectedOrderSummary: orderSummary,
    };
  }

  /**
   * Resolves the exact subject for a specific question number using the detected paper structure.
   */
  static getSubjectForQuestion(qNum: number, structure: NEETPaperStructure, questionText?: string): string {
    // 1. Check if questionText has high confidence subject indicator
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

    // 2. Lookup in detected subjectRanges
    for (const range of structure.subjectRanges) {
      if (qNum >= range.startQ && qNum <= range.endQ) {
        return range.subject;
      }
    }

    // Fallback based on question number ranges
    if (qNum <= 50) return 'Physics';
    if (qNum <= 100) return 'Chemistry';
    if (qNum <= 150) return 'Botany';
    return 'Zoology';
  }
}

