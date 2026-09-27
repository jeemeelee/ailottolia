# AILOTTOLIA

Existing blue/white static site on Vercel; no build step, paid AI API, or service-role key needed. Both pages use the existing public Supabase project configuration in `js/db.js`.

## Weekly rules

`/admin` authenticates using Supabase Auth, verifies the server-managed administrator allowlist, validates the entire prompt and confirms that a valid combination exists. Saving calls `save_weekly_prompt`, which checks administrator membership and atomically switches the active row in `weekly_prompts`. Every click on the main site's generate button fetches the latest active rule without cache. A read/parse failure displays an error instead of generating numbers with stale or ignored rules.

Supported examples (combine with `/` or newlines):

- `홀수 3개, 짝수 3개` or `홀짝 비율 3:3`
- `7, 12 포함` or `포함 번호: 7, 12`
- `1, 2 제외` or `제외 번호: 1, 2`
- `번호 범위 1~40`
- `구간 1~10에서 2개` (exact count; at most five non-overlapping intervals)
- `연속번호 제외` / `연속번호 허용`
- `기본` / `무작위` for unrestricted selection

Rules apply to each of five games. Each game contains six unique, ascending integers from 1–45. Different games may repeat, particularly if only one combination satisfies the rules. “Consecutive allowed” permits adjacent numbers but does not require them. Omitted conditions impose no restriction. Unsupported prose, overlapping intervals, contradictory clauses, and impossible combinations are rejected.

The generator counts feasible combinations with memoization and samples by branch weights; it never drops constraints or relies on retries. Odds of winning are not improved by these conditions.

## Database deployment

Apply `supabase/migrations/202609270001_weekly_prompt_rules.sql` using the project SQL editor or migrations. Existing prompt history is preserved. It replaces legacy table policies, revokes direct client writes, and permits only active prompt reads. Enroll only the verified existing administrator Auth user:

```sql
insert into public.prompt_admins(user_id) values ('VERIFIED_EXISTING_AUTH_USER_UUID') on conflict do nothing;
```

No client may enroll itself. Ordinary signed-in users do not become administrators. The exact legacy template currently stored by this project (the standard six-number/five-game sentence followed by `모든 게임에 1번을 반드시 포함한다.`) is also supported. Other free-form prompts must be re-saved in a supported format.

## Verification

Run `npm test` (Node 22 or newer). Tests check over 5,000 games across combined constraints, unsupported/impossible rules, singleton solutions, and independent exhaustive combination counts. Deploy through the existing GitHub main → Vercel production integration after migration; test saving and generating on the production domain. Also verify anonymous writes and ordinary authenticated writes are rejected, with active rules publicly readable.
