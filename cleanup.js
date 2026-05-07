process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qvblamgdbtulxhbgkwaz.supabase.co'
const supabaseAnonKey = 'sb_publishable_hrSYIz0gfY1z3fW8Wq9m7g_S2JoRtlj'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function cleanup() {
  console.log('Cleaning up duplicate tasks and attendance...')
  
  const { data: reports } = await supabase.from('reports').select('id, user_id')
  
  await supabase.from('tasks').delete().neq('id', 0)
  await supabase.from('attendance').delete().neq('id', 0)
  
  if (reports && reports.length > 0) {
    console.log('Re-inserting one set of tasks...')
    const rep1 = reports.find(r => r.user_id === '11111111-1111-1111-1111-111111111111')?.id
    const rep2 = reports.find(r => r.user_id === '22222222-2222-2222-2222-222222222222')?.id
    const rep3 = reports.find(r => r.user_id === '33333333-3333-3333-3333-333333333333')?.id
    const rep4 = reports.find(r => r.user_id === '44444444-4444-4444-4444-444444444444')?.id
    const rep5 = reports.find(r => r.user_id === '55555555-5555-5555-5555-555555555555')?.id

    if (rep1) {
        await supabase.from('tasks').insert([
          { report_id: rep1, status: '진행', text: '신규 AI 프로젝트 기획안 작성', deadline: '5.14(목)' },
          { report_id: rep1, status: '완료', text: '타 부서 협의체 미팅 준비', deadline: '5.12(화)' },
          { report_id: rep2, status: '진행', text: '부서별 예산 집행 현황 취합', deadline: '5.15(금)' },
          { report_id: rep2, status: '예정', text: '주간 보고서 초안 작성', deadline: '5.15(금)' },
          { report_id: rep3, status: '완료', text: '정책 가이드라인 개정안 리뷰', deadline: '5.11(월)' },
          { report_id: rep3, status: '지연', text: '사내 공지사항 초안 작성', deadline: '5.13(수)' },
          { report_id: rep4, status: '진행', text: '데이터 대시보드 지표 업데이트', deadline: '5.14(목)' },
          { report_id: rep4, status: '진행', text: '경영진 보고용 시각화 자료 준비', deadline: '5.15(금)' },
          { report_id: rep5, status: '완료', text: '신규 입사자 온보딩 세션 진행', deadline: '5.12(화)' },
          { report_id: rep5, status: '완료', text: '팀 내 리소스 관리 시트 업데이트', deadline: '5.13(수)' }
        ])
    }
  }

  console.log('Re-inserting one set of attendance...')
  await supabase.from('attendance').insert([
    { user_id: '11111111-1111-1111-1111-111111111111', type: '자율출퇴근제', start_date: '2026-05-11', end_date: '2026-05-11', time_option: '08:00~17:00' },
    { user_id: '11111111-1111-1111-1111-111111111111', type: '자율출퇴근제', start_date: '2026-05-13', end_date: '2026-05-13', time_option: '08:00~17:00' },
    { user_id: '33333333-3333-3333-3333-333333333333', type: '반차', start_date: '2026-05-15', end_date: '2026-05-15', time_option: '오후' },
    { user_id: '55555555-5555-5555-5555-555555555555', type: '휴가', start_date: '2026-05-14', end_date: '2026-05-15', time_option: '종일' }
  ])
  console.log('Cleanup complete!')
}

cleanup()
