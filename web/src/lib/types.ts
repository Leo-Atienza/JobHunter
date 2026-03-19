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
}

export type JobStatus = 'new' | 'saved' | 'applied' | 'interview' | 'rejected' | 'dismissed';

export const JOB_STATUSES: JobStatus[] = ['new', 'saved', 'applied', 'interview', 'rejected', 'dismissed'];

export interface Session {
  code: string;
  created_at: string;
  expires_at: string;
  keywords: string[] | null;
  location: string | null;
  sources: string[] | null;
  remote: boolean;
}

export interface JobStats {
  total: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  last_updated: string | null;
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
}

export interface CreateSessionRequest {
  keywords?: string[];
  location?: string;
  sources?: string[];
  remote?: boolean;
}

export interface CreateSessionResponse {
  code: string;
  expires_at: string;
}

export interface InsertJobsResponse {
  inserted: number;
  duplicates: number;
}

export const JOB_SOURCES = ['linkedin', 'indeed', 'glassdoor', 'jobbank', 'remotive', 'adzuna'] as const;
export type JobSource = (typeof JOB_SOURCES)[number];
