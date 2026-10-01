export type ProfileName = "Patrik" | "Fabian";
export type Attempt = {
  id: string;
  label: string;
  at: number;
  score: number;
  answers: { id: string; answer: string; correct: boolean }[];
};
export type Review = {
  id: string;
  day: number;
  stage: number;
  due: number;
  resolved: boolean;
};
export type Note = {
  id: string;
  date: string;
  topic: string;
  insight: string;
  mistake: string;
  next: string;
};
export type Profile = {
  read: number[];
  attempts: Attempt[];
  errors: Review[];
  notes: Note[];
  practice: { id: string; passed: boolean; at: number; variant: number }[];
  sessions: { date: string; seconds: number }[];
  rules: string[];
};
export type Store = {
  version: number;
  active: ProfileName;
  profiles: Record<ProfileName, Profile>;
};
