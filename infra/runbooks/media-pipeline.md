# Media Pipeline Runbook

## Symptoms
- Upload completes but media status stays `uploaded` or `processing`
- Timeline shows broken media URLs

## Checks
1. Verify `worker` service health/logs for BullMQ job failures.
2. Inspect Redis queue depth and failed jobs for `media-processing`.
3. Query `media_assets` rows by status and `job_events` for failure payloads.
4. Verify R2 credentials and bucket permissions.
5. Check `R2_PUBLIC_BASE_URL` and CDN routing.

## Recovery
1. Restart worker service.
2. Replay failed jobs or re-enqueue by media ID.
3. For permanently failed media, mark as `failed` and notify client to re-upload.

## Preventive actions
- Alert on queue backlog > threshold.
- Alert on `failed` ratio spikes.
- Keep worker concurrency and retry policy under controlled load tests.
