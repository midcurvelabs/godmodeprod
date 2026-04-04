-- Partial index for the job poller: fast lookup of pending jobs ordered by creation time
CREATE INDEX idx_jobs_pending_created ON jobs(status, created_at ASC) WHERE status = 'pending';
