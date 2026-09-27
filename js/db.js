// Existing public project configuration. Never put service_role keys here.
export const db = window.supabase.createClient(
  'https://zhrpuxumusbfleuaugzh.supabase.co',
  'sb_publishable_CbbBb4fxUtRg3u1SR8vEnA_ku-gLdQ1',
  {global: {fetch: (url, options) => fetch(url, {...options, cache: 'no-store'})}}
);
export async function loadActivePrompt() {
  const {data, error} = await db.from('weekly_prompts').select('prompt,created_at').eq('is_active', true).order('created_at', {ascending: false}).limit(1).abortSignal(AbortSignal.timeout(12000));
  if (error) throw new Error('현재 규칙을 불러오지 못했습니다. 잠시 후 다시 시도하세요.');
  if (!data?.length) throw new Error('활성 규칙이 없습니다. 관리자가 규칙을 저장한 후 이용할 수 있습니다.');
  return data[0];
}
