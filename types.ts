export enum BotRole {
  CODING = 'CODING',
  RESUME = 'RESUME',
  ORGANIZER = 'ORGANIZER',
  QUIZ_EXPERT = 'QUIZ_EXPERT'
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export interface Chapter {
  id: string;
  title: string;
  goal: string;
  concepts: string[];
  estimatedTime: string;
  isCompleted: boolean;
  flashcards: Flashcard[];
}

export interface LibraryItem {
  title: string;
  type: 'PDF' | 'Link' | 'Doc';
  url?: string;
  difficulty?: 'Sahl' | 'Moyenn' | 'S3ib';
  chapters?: Chapter[];
}

export interface QuizHistoryItem {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: number;
}

export interface ThemeConfig {
  glowColor: string;
  accentColor: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface QuizSession {
  questions: QuizQuestion[];
  currentIndex: number;
  userAnswers: number[];
  score: number;
  isComplete: boolean;
  topic: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  imageUrl?: string;
  isImage?: boolean;
  generatedImageUrl?: string;
}

export interface BotConfig {
  id: BotRole;
  name: string;
  description: string;
  icon: string;
  systemInstruction: string;
  color: string;
  model: string;
  library: LibraryItem[];
  themeConfig: ThemeConfig;
  domainKnowledge: string;
}