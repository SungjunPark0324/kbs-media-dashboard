process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qvblamgdbtulxhbgkwaz.supabase.co'
const supabaseAnonKey = 'sb_publishable_hrSYIz0gfY1z3fW8Wq9m7g_S2JoRtlj'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seedW1() {
  const { data: reports, error: reportError } = await supabase.from('reports').upsert([
    { week_id: '2026-05-w1', user_id: '11111111-1111-1111-1111-111111111111', bottlenecks: '' },
    { week_id: '2026-05-w1', user_id: '22222222-2222-2222-2222-222222222222', bottlenecks: '• 전산 장비 교체 일정 지연' },
    { week_id: '2026-05-w1', user_id: '33333333-3333-3333-3333-333333333333', bottlenecks: '' },
    { week_id: '2026-05-w1', user_id: '44444444-4444-4444-4444-444444444444', bottlenecks: '• 외주 업체 연락 두절로 인한 지연' },
    { week_id: '2026-05-w1', user_id: '55555555-5555-5555-5555-555555555555', bottlenecks: '' }
  ], { onConflict: 'week_id,user_id' }).select()

  if (reports && reports.length > 0) {
    const rep1 = reports.find(r => r.user_id === '11111111-1111-1111-1111-111111111111')?.id
    const rep2 = reports.find(r => r.user_id === '22222222-2222-2222-2222-222222222222')?.id
    const rep3 = reports.find(r => r.user_id === '33333333-3333-3333-3333-333333333333')?.id
    const rep4 = reports.find(r => r.user_id === '44444444-4444-4444-4444-444444444444')?.id
    const rep5 = reports.find(r => r.user_id === '55555555-5555-5555-5555-555555555555')?.id

    await supabase.from('tasks').delete().in('report_id', reports.map(r => r.id))

    await supabase.from('tasks').insert([
      { report_id: rep1, status: '완료', text: '5월 기획 회의 준비', deadline: '5.6(수)' },
      { report_id: rep1, status: '진행', text: '부서별 업무 분장 초안 작성', deadline: '5.8(금)' },
      { report_id: rep2, status: '진행', text: '경영진 주간 보고 자료 취합', deadline: '5.7(목)' },
      { report_id: rep3, status: '완료', text: '사내 가이드라인 워크숍 참석', deadline: '5.4(월)' },
      { report_id: rep4, status: '지연', text: '외부 업체 계약 검토', deadline: '5.8(금)' },
      { report_id: rep5, status: '예정', text: '신규 입사자 명단 취합', deadline: '5.8(금)' }
    ])

    // Attendance dates for w1 (May 4 - May 8)
    await supabase.from('attendance')
      .delete()
      .gte('start_date', '2026-05-04')
      .lte('start_date', '2026-05-08')

    await supabase.from('attendance').insert([
      { user_id: '11111111-1111-1111-1111-111111111111', type: '휴가', start_date: '2026-05-08', end_date: '2026-05-08', time_option: '종일' },
      { user_id: '44444444-4444-4444-4444-444444444444', type: '반차', start_date: '2026-05-06', end_date: '2026-05-06', time_option: '오전' },
      { user_id: '55555555-5555-5555-5555-555555555555', type: '자율출퇴근제', start_date: '2026-05-04', end_date: '2026-05-04', time_option: '10:00~19:00' }
    ])
  }
  console.log('5월 1주 차 데이터 세팅 완료!')
}
seedW1()
