-- DC-OPS-01: align queue production with the free public runner (every 15 minutes).
-- Queue each stage shortly before the runner starts to avoid a permanent backlog.
select cron.alter_job(9, schedule := '11,26,41,56 * * * *');
select cron.alter_job(8, schedule := '12,27,42,57 * * * *');
select cron.alter_job(10, schedule := '13,28,43,58 * * * *');
select cron.alter_job(12, schedule := '14,29,44,59 * * * *');
