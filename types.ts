
export enum Tense {
  PRESENT = 'Present',
  PRETERITE = 'Preterite'
}

export enum VerbCategory {
  REGULAR = 'Regular ar/er/ir',
  IRREGULAR = 'Irregular'
}

export type Subject = 'Yo' | 'Tú' | 'Él/Ella/Usted' | 'Nosotros' | 'Ellos/Ellas/Ustedes';

export interface Conjugation {
  Yo: string;
  Tú: string;
  'Él/Ella/Usted': string;
  Nosotros: string;
  'Ellos/Ellas/Ustedes': string;
}

export interface VerbData {
  infinitive: string;
  meaning: string;
  category: VerbCategory;
  conjugations: {
    [key in Tense]: Conjugation;
  };
}

export interface PracticeStats {
  correct: number;
  incorrect: number;
  total: number;
}

export interface Feedback {
  isCorrect: boolean;
  isAccentError: boolean;
  correctAnswer: string;
  userAnswer: string;
}
