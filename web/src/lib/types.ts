import type { MatchBreakdown } from './match-scoring';

export interface Job {
  id: number;
  session_code: string;
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  source: string;
  salary: string | null;
  description: string | null;
  posted_date: string | null;
  scraped_at: string;
  status: JobStatus;
  notes: string | null;
  job_type: string | null;
  experience_level: string | null;
  skills: string | null;
  benefits: string | null;
  relevance_score: number;
  country: string | null;
  /** FK to the original job this is a cross-source duplicate of */
  duplicate_of: number | null;
  /** Parsed annual salary min */
  salary_min: number | null;
  /** Parsed annual salary max */
  salary_max: number | null;
  /** AI-generated summary */
  ai_summary: string | null;
  /** Whether the job URL appears to be dead (404/410) */
  is_ghost: boolean;
  /** When the status was last changed */
  status_changed_at: string | null;
  /** Match score breakdown (skill/title/desc/exp scores + matched items) */
  score_breakdown: MatchBreakdown | null;
  /** Sources that also have this job (populated client-side from duplicates) */
  also_on?: string[];
}

export type JobStatus =
  | 'new'
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'dismissed';

export const JOB_STATUSES: JobStatus[] = [
  'new',
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
  'dismissed',
];

export interface Session {
  code: string;
  created_at: string;
  expires_at: string;
  keywords: string[] | null;
  location: string | null;
  /** All searched cities (superset of location) */
  locations: string[] | null;
  sources: string[] | null;
  remote: boolean;
  /** Whether remote jobs are included in results (default true) */
  include_remote: boolean;
  companies: string[] | null;
  country: string | null;
  user_id: string | null;
  resume_skills: ResumeProfile | null;
}

export interface JobStats {
  total: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  last_updated: string | null;
  avg_salary: number | null;
  with_salary_count: number;
  ghost_count: number;
  avg_match: number | null;
}

export interface JobInput {
  title: string;
  company?: string;
  location?: string;
  url: string;
  source: string;
  salary?: string;
  description?: string;
  posted_date?: string;
  job_type?: string;
  experience_level?: string;
  skills?: string;
  benefits?: string;
  relevance_score?: number;
  score_breakdown?: MatchBreakdown;
  country?: string;
}

export interface CreateSessionRequest {
  keywords?: string[];
  location?: string;
  /** Multi-city search — array of location strings */
  locations?: string[];
  sources?: string[];
  remote?: boolean;
  /** Whether to include remote jobs in results (default true) */
  include_remote?: boolean;
  companies?: string[];
  country?: string;
  resume_text?: string;
}

export interface CreateSessionResponse {
  code: string;
  expires_at: string;
}

export interface InsertJobsResponse {
  inserted: number;
  duplicates: number;
}

export interface ResumeProfile {
  skills: string[];
  experience_years: number | null;
  titles: string[];
  summary: string;
}

export const JOB_SOURCES = [
  'jobbank',
  'linkedin-public',
  'remotive',
  'adzuna',
  'himalayas',
  'lever',
  'greenhouse',
  'jooble',
  'jobicy',
  'devitjobs',
  'firecrawl',
  'remoteok',
  'weworkremotely',
  'indeed-rss',
  'careerjet',
  'talent',
] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

/** Scrapers that only return remote jobs — auto-deselected when "Include remote" is OFF. */
export const REMOTE_ONLY_SOURCES: readonly JobSource[] = ['remoteok', 'weworkremotely', 'remotive'];
