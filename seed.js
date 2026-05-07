process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qvblamgdbtulxhbgkwaz.supabase.co'
const supabaseAnonKey = 'sb_publishable_hrSYIz0gfY1z3fW8Wq9m7g_S2JoRtlj'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seed() {
  try {
    console.log('1. 프로필 (Profiles) 데이터 삽입 중...')
    await supabase.from('profiles').upsert([
      { id: '11111111-1111-1111-1111-111111111111', employee_id: '10319', name: '박성준', profile_img: '/images/profile_10319.jpg' },
      { id: '22222222-2222-2222-2222-222222222222', employee_id: '10181', name: '김유정', profile_img: '/images/profile_10181.jpg' },
      { id: '33333333-3333-3333-3333-333333333333', employee_id: '10212', name: '정성은', profile_img: '/images/profile_10212.jpg' },
      { id: '44444444-4444-4444-4444-444444444444', employee_id: '10227', name: '김연희', profile_img: '/images/profile_10270.jpg' },
      { id: '55555555-5555-5555-5555-555555555555', employee_id: '10270', name: '신혜영', profile_img: '/images/profile_10227.jpg' }
    ])

    console.log('2. 주차 (Weeks) 데이터 삽입 중...')
    await supabase.from('weeks').upsert([
      { id: '2026-05-w1', title: '5월 1주 차', date_str: '5. 4. ~ 5. 8.', start_date: '2026-05-04', end_date: '2026-05-08', team_notice: '어린이날 휴무로 인해 주간 회의는 수요일로 연기되었습니다.' },
      { id: '2026-05-w2', title: '5월 2주 차', date_str: '5. 11. ~ 5. 15.', start_date: '2026-05-11', end_date: '2026-05-15', team_notice: '이번 주 금요일(5/15)은 본부 문화의 날 행사로 인해 오후 3시까지만 정상 근무합니다.' }
    ])

    console.log('3. 현황 (Reports) 데이터 삽입 중...')
    const { data: reports, error: reportError } = await supabase.from('reports').upsert([
      { week_id: '2026-05-w2', user_id: '11111111-1111-1111-1111-111111111111', bottlenecks: '• 데이터 권한 승인 지연으로 인한 분석 일정 차질 (IT지원팀 확인 필요)' },
      { week_id: '2026-05-w2', user_id: '22222222-2222-2222-2222-222222222222', bottlenecks: '' },
      { week_id: '2026-05-w2', user_id: '33333333-3333-3333-3333-333333333333', bottlenecks: '• 유관 부서(법무팀) 피드백 지연으로 배포 일정 연기 우려' },
      { week_id: '2026-05-w2', user_id: '44444444-4444-4444-4444-444444444444', bottlenecks: '' },
      { week_id: '2026-05-w2', user_id: '55555555-5555-5555-5555-555555555555', bottlenecks: '' }
    ], { onConflict: 'week_id,user_id' }).select()

    if (reportError) {
      console.error('Reports Error:', reportError)
      return
    }

    if (reports && reports.length > 0) {
      console.log('4. 핵심 업무 (Tasks) 데이터 삽입 중...')
      const rep1 = reports.find(r => r.user_id === '11111111-1111-1111-1111-111111111111')?.id
      const rep2 = reports.find(r => r.user_id === '22222222-2222-2222-2222-222222222222')?.id
      const rep3 = reports.find(r => r.user_id === '33333333-3333-3333-3333-333333333333')?.id
      const rep4 = reports.find(r => r.user_id === '44444444-4444-4444-4444-444444444444')?.id
      const rep5 = reports.find(r => r.user_id === '55555555-5555-5555-5555-555555555555')?.id

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

    console.log('5. 근태 일정 (Attendance) 데이터 삽입 중...')
    await supabase.from('attendance').insert([
      { user_id: '11111111-1111-1111-1111-111111111111', type: '자율출퇴근제', start_date: '2026-05-11', end_date: '2026-05-11', time_option: '08:00~17:00' },
      { user_id: '11111111-1111-1111-1111-111111111111', type: '자율출퇴근제', start_date: '2026-05-13', end_date: '2026-05-13', time_option: '08:00~17:00' },
      { user_id: '33333333-3333-3333-3333-333333333333', type: '반차', start_date: '2026-05-15', end_date: '2026-05-15', time_option: '오후' },
      { user_id: '55555555-5555-5555-5555-555555555555', type: '휴가', start_date: '2026-05-14', end_date: '2026-05-15', time_option: '종일' }
    ])

    console.log('✅ 모든 가짜 데이터 삽입이 성공적으로 완료되었습니다!')
  } catch (err) {
    console.error('Error seeding data:', err)
  }
}

seed()
