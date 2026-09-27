// Query only on the server, after administrator authentication.
export async function analytics() {
  const accessToken = process.env.VERCEL_ANALYTICS_TOKEN;
  const project = process.env.VERCEL_ANALYTICS_PROJECT_ID;
  if (!accessToken || !project) return { status: 'unconfigured', days: [] };
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - 6);
  since.setUTCHours(0, 0, 0, 0);
  const url = new URL('https://api.vercel.com/v1/query/web-analytics/visits/aggregate');
  url.search = new URLSearchParams({ projectId: project, since: since.toISOString(), until: until.toISOString(), by: 'day', filter: "requestPath eq '/'" });
  if (process.env.VERCEL_ANALYTICS_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_ANALYTICS_TEAM_ID);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Analytics unavailable');
    const result = await response.json();
    if (!Array.isArray(result.data)) throw new Error('Invalid analytics');
    const days = result.data.map(row => {
      if (!/^\d{4}-\d{2}-\d{2}T/.test(row.timestamp) || !Number.isFinite(row.visitors) || row.visitors < 0 || !Number.isFinite(row.pageviews) || row.pageviews < 0) throw new Error('Invalid analytics');
      return { date: row.timestamp.slice(0, 10), visitors: row.visitors, pageviews: row.pageviews };
    });
    return { status: 'ready', days };
  } catch {
    return { status: 'unavailable', days: [] };
  }
}
