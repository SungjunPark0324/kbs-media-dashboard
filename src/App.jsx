import { useState, useEffect } from 'react'
import { 
  ChevronLeft, ChevronRight, Info, AlertTriangle, Calendar, Target,
  Megaphone, User, X, Plus, Trash2, Clock, Loader2, Edit3, Save, LogOut, Lock, MessageSquare
} from 'lucide-react'
import { supabase } from './supabaseClient'
import Auth from './Auth'

const GUIDELINES = [
  { title: "운영 목적", desc: "팀원 간 핵심 업무 현황 투명 공유, 선제적 병목 파악을 통한 상호 협조 및 리소스 조율" },
  { title: "작성 기한", desc: "매주 금요일 퇴근 전까지 '차주 업무 계획 및 근태 일정' 작성 완료" },
  { title: "투명한 이슈 공유", desc: "병목사항(타 부서 협조 지연, 리소스 부족 등)은 가감 없이 투명하게 작성" },
  { title: "Action Item 중심", desc: "장황한 서술을 지양하고 실행 중심의 구체적인 액션 아이템 위주로 작성" }
]

// --- UTILITY ---
function generateWeeklyCalendar(weekData, reports) {
  if (!weekData || !reports) return []
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const start = new Date(weekData.start_date)
  const calendar = []
  
  for(let i=0; i<5; i++) { // Monday to Friday
     const currentDay = new Date(start)
     currentDay.setDate(start.getDate() + i)
     const dateStr = `${currentDay.getMonth()+1}.${currentDay.getDate()}`
     const dayOfWeek = days[currentDay.getDay()]
     
     const events = []
     reports.forEach(userReport => {
        if (!userReport.attendance) return;
        userReport.attendance.forEach(att => {
           if (!att.start_date) return;
           const attStart = new Date(att.start_date)
           const attEnd = att.end_date ? new Date(att.end_date) : attStart
           
           // Standardize times to midnight for accurate comparison
           const currTime = currentDay.getTime()
           if (currTime >= attStart.getTime() && currTime <= attEnd.getTime()) {
             events.push({
               name: userReport.name,
               type: att.type,
               time: att.time_option || '종일',
               startDate: att.start_date,
               endDate: att.end_date
             })
           }
        })
     })
     
     const TYPE_ORDER = ['휴가', '반차', '자율출퇴근제']
     const FIXED_ORDER = ['박성준', '김유정', '정성은', '김연희', '신혜영']
     
     events.sort((a, b) => {
       const typeA = TYPE_ORDER.indexOf(a.type)
       const typeB = TYPE_ORDER.indexOf(b.type)
       if (typeA !== typeB) return (typeA === -1 ? 99 : typeA) - (typeB === -1 ? 99 : typeB)
       
       const nameA = FIXED_ORDER.indexOf(a.name)
       const nameB = FIXED_ORDER.indexOf(b.name)
       return (nameA === -1 ? 99 : nameA) - (nameB === -1 ? 99 : nameB)
     })
     
     calendar.push({ date: dateStr, day: dayOfWeek, events })
  }
  return calendar
}

function formatDateString(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth()+1}.${d.getDate()}(${days[d.getDay()]})`
}

function renderAttendanceBadge(att) {
  let label = att.type
  if (att.type === '자율출퇴근제' || att.type === '반차') {
    label += ` (${att.time_option})`
  }
  
  let dateLabel = formatDateString(att.start_date)
  if (att.end_date && att.start_date !== att.end_date) {
    dateLabel += `~${formatDateString(att.end_date)}`
  }

  const bgColor = att.type === '휴가' ? 'rgba(239, 68, 68, 0.1)' : 
                  att.type === '반차' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 130, 185, 0.1)'
  const color = att.type === '휴가' ? '#ef4444' : 
                att.type === '반차' ? '#d97706' : 'var(--kbs-blue)'

  return (
    <span key={att.id} style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px',
      background: bgColor, color: color, fontWeight: '600'
    }}>
      <Clock size={12} /> {dateLabel} {label}
    </span>
  )
}

// --- MAIN COMPONENT ---
function App() {
  const [session, setSession] = useState(null)
  const [currentUserProfile, setCurrentUserProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [weeksData, setWeeksData] = useState([])
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0)
  const [showGuidelines, setShowGuidelines] = useState(true)
  const [reportsData, setReportsData] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [isEditingNotice, setIsEditingNotice] = useState(false)
  const [noticeText, setNoticeText] = useState('')

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('')

  const [editingComment, setEditingComment] = useState(null)
  // Shape: { reportId: string, section: 'tasks' | 'bottlenecks', value: string }
  const [isSavingComment, setIsSavingComment] = useState(false)

  const formatDateShort = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr
    const [y, m, d] = dateStr.split('-')
    return `${parseInt(m)}.${parseInt(d)}`
  }

  // Auth Effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUserProfile(session.user.id)
      else setIsLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUserProfile(session.user.id)
      else setIsLoading(false)
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setCurrentUserProfile(data)
    if (data) fetchAllData(true) // Fetch rest of data only after profile is loaded
  }

  const [formData, setFormData] = useState({
    coreTasks: [],
    bottlenecks: '',
    attendance: []
  })

  const jumpToCurrentWeek = (data = weeksData) => {
    const now = new Date()
    now.setHours(0,0,0,0)
    let foundIndex = 0
    for (let i = 0; i < data.length; i++) {
      const wStart = new Date(data[i].start_date)
      wStart.setHours(0,0,0,0)
      if (now >= wStart) {
        foundIndex = i
        break
      }
    }
    setCurrentWeekIndex(foundIndex)
  }

  // Data Fetching
  const fetchAllData = async (isInitialLoad = false) => {
    setIsLoading(true)
    
    // 1. Fetch weeks
    const { data: wData } = await supabase.from('weeks').select('*').order('start_date', { ascending: false })
    
    // 2. Fetch reports with profiles and tasks
    const { data: rData } = await supabase.from('reports').select(`
      id, week_id, bottlenecks,
      profiles ( id, name, profile_img, employee_id ),
      tasks ( id, status, text, deadline )
    `)

    // 3. Fetch attendance
    const { data: aData } = await supabase.from('attendance').select('*')

    // 4. Fetch leader comments
    const { data: cData } = await supabase.from('leader_comments').select('*')

    // 5. Fetch all profiles to ensure everyone has a card even if no report exists
    const { data: allProfiles } = await supabase.from('profiles').select('*')

    if (wData && wData.length > 0) {
      setWeeksData(wData)
      
      const formattedReports = {}
      wData.forEach(w => {
        formattedReports[w.id] = []
        if (allProfiles) {
          allProfiles.forEach(p => {
            // Find if this user has a report for this week
            const existingReport = (rData || []).find(r => r.week_id === w.id && r.profiles.id === p.id)
            const userAttendance = (aData || []).filter(a => {
              if (a.user_id !== p.id) return false;
              const aStart = new Date(a.start_date)
              aStart.setHours(0,0,0,0)
              const aEnd = new Date(a.end_date || a.start_date)
              aEnd.setHours(23,59,59,999)
              const wStart = new Date(w.start_date)
              wStart.setHours(0,0,0,0)
              const wEnd = new Date(w.end_date)
              wEnd.setHours(23,59,59,999)
              return (aStart <= wEnd && aEnd >= wStart)
            })
            
            if (existingReport) {
              const existingComment = (cData || []).find(c => c.report_id === existingReport.id)
              formattedReports[w.id].push({
                id: p.id,
                reportId: existingReport.id,
                name: p.name,
                profileImg: p.profile_img,
                employee_id: p.employee_id,
                coreTasks: existingReport.tasks || [],
                bottlenecks: existingReport.bottlenecks || '',
                attendance: userAttendance,
                leaderComment: {
                  tasksComment: (existingComment?.tasks_comment || '').trim(),
                  bottlenecksComment: (existingComment?.bottlenecks_comment || '').trim(),
                  tasksAuthorId: existingComment?.tasks_comment_author_id || null,
                  bottlenecksAuthorId: existingComment?.bottlenecks_comment_author_id || null
                }
              })
            } else {
              formattedReports[w.id].push({
                id: p.id,
                reportId: null,
                name: p.name,
                profileImg: p.profile_img,
                employee_id: p.employee_id,
                coreTasks: [],
                bottlenecks: '',
                attendance: userAttendance,
                leaderComment: { tasksComment: '', bottlenecksComment: '', tasksAuthorId: null, bottlenecksAuthorId: null }
              })
            }
          })
        }
        // 지정된 순서대로 정렬
        const FIXED_ORDER = ['박성준', '김유정', '정성은', '김연희', '신혜영']
        formattedReports[w.id].sort((a, b) => {
          const indexA = FIXED_ORDER.indexOf(a.name)
          const indexB = FIXED_ORDER.indexOf(b.name)
          return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB)
        })
      })
      setReportsData(formattedReports)
      
      if (isInitialLoad) {
        jumpToCurrentWeek(wData)
      }
    }
    
    setIsLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (!session) {
    return <Auth />
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', color: 'var(--kbs-blue)' }}>
        <Loader2 size={40} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontWeight: '600' }}>데이터를 불러오는 중입니다...</div>
      </div>
    )
  }

  const currentWeek = weeksData[currentWeekIndex]
  if (!currentWeek || !currentUserProfile) return null

  const isTeamLeader = currentUserProfile.employee_id === '10319' // 박성준 팀장 권한
  const weekReports = reportsData[currentWeek.id] || []
  const weeklyCalendarData = generateWeeklyCalendar(currentWeek, weekReports)

  const handlePrevWeek = () => {
    if (currentWeekIndex < weeksData.length - 1) setCurrentWeekIndex(currentWeekIndex + 1)
  }

  const handleNextWeek = async () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1)
      return
    }

    const latestWeek = weeksData[0]
    if (!latestWeek) return

    setIsLoading(true)
    const currentStart = new Date(latestWeek.start_date)
    const nextStart = new Date(currentStart)
    nextStart.setDate(nextStart.getDate() + 7) 
    
    const nextEnd = new Date(nextStart)
    nextEnd.setDate(nextEnd.getDate() + 4) 

    const startMonth = nextStart.getMonth() + 1
    const startStr = `${startMonth}. ${nextStart.getDate()}.`
    const endMonth = nextEnd.getMonth() + 1
    const endStr = `${endMonth}. ${nextEnd.getDate()}.`

    let nextWeekNum = 1
    const prevMonth = currentStart.getMonth() + 1
    if (startMonth === prevMonth) {
      const weekMatch = latestWeek.title.match(/(\d+)주 차/)
      if (weekMatch) {
        nextWeekNum = parseInt(weekMatch[1]) + 1
      }
    }
    const newTitle = `${startMonth}월 ${nextWeekNum}주 차`
    const nextId = `week-${Date.now()}`

    const { data: existing } = await supabase.from('weeks').select('*').eq('start_date', nextStart.toISOString().split('T')[0]).single()
    
    if (existing) {
       await fetchAllData()
       setCurrentWeekIndex(0)
       return
    }

    const { error } = await supabase.from('weeks').insert({
      id: nextId,
      title: newTitle,
      date_str: `${startStr} ~ ${endStr}`,
      start_date: nextStart.toISOString().split('T')[0],
      end_date: nextEnd.toISOString().split('T')[0]
    })

    if (!error) {
      await fetchAllData()
      setCurrentWeekIndex(0) 
    } else {
      alert('주차 생성에 실패했습니다.')
      setIsLoading(false)
    }
  }

  const handleOpenModal = () => {
    const existingReport = weekReports.find(r => r.id === currentUserProfile.id)
    
    let inheritedTasks = []
    if (!existingReport || !existingReport.coreTasks || existingReport.coreTasks.length === 0) {
      const prevWeek = weeksData[currentWeekIndex + 1]
      if (prevWeek) {
        const prevWeekReports = reportsData[prevWeek.id] || []
        const prevReport = prevWeekReports.find(r => r.id === currentUserProfile.id)
        if (prevReport && prevReport.coreTasks) {
          inheritedTasks = prevReport.coreTasks
            .filter(t => t.status !== '완료')
            .map(t => ({
              id: Date.now() + Math.random(),
              status: t.status,
              text: t.text,
              deadline: t.deadline
            }))
        }
      }
    }

    const convertLegacyDate = (dateStr) => {
      if (!dateStr) return '';
      if (dateStr.includes('-')) return dateStr;
      const match = dateStr.match(/(\d+)\.(\d+)/);
      if (match) {
        const m = match[1].padStart(2, '0');
        const d = match[2].padStart(2, '0');
        return `2026-${m}-${d}`;
      }
      return '';
    }

    if (existingReport) {
      const initialTasks = existingReport.coreTasks && existingReport.coreTasks.length > 0 
          ? existingReport.coreTasks.map(t => ({...t, id: t.id || Date.now() + Math.random(), deadline: convertLegacyDate(t.deadline)})) 
          : inheritedTasks.length > 0 ? inheritedTasks.map(t => ({...t, deadline: convertLegacyDate(t.deadline)})) : [{ id: Date.now(), status: '진행', text: '', deadline: '' }]

      setFormData({
        coreTasks: initialTasks,
        bottlenecks: existingReport.bottlenecks || '',
        attendance: existingReport.attendance.map(a => ({
          ...a, 
          startDate: a.start_date, 
          endDate: a.end_date, 
          timeOption: a.time_option
        }))
      })
    }
    setIsModalOpen(true)
  }

  const handleSaveReport = async () => {
    setIsSaving(true)
    
    try {
      // 1. Report (Upsert)
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .upsert({
          week_id: currentWeek.id,
          user_id: currentUserProfile.id,
          bottlenecks: formData.bottlenecks,
          updated_at: new Date()
        }, { onConflict: 'week_id,user_id' })
        .select('id')
        .single()
        
      if (reportError) throw reportError
      const reportId = reportData?.id

      // 2. Tasks (Sync)
      if (reportId) {
        await supabase.from('tasks').delete().eq('report_id', reportId)
        const tasksToInsert = formData.coreTasks
          .filter(t => t.text.trim() !== '')
          .map(t => ({
            report_id: reportId,
            status: t.status,
            text: t.text,
            deadline: t.deadline
          }))
        if (tasksToInsert.length > 0) {
          await supabase.from('tasks').insert(tasksToInsert)
        }
      }

      // 3. Attendance (Sync safely without deleting other weeks)
      const existingAttIds = (weekReports.find(r => r.id === currentUserProfile.id)?.attendance || []).map(a => a.id)
      const currentFormIds = formData.attendance.map(a => a.id)
      const idsToDelete = existingAttIds.filter(id => !currentFormIds.includes(id))
      
      if (idsToDelete.length > 0) {
        await supabase.from('attendance').delete().in('id', idsToDelete)
      }
      
      const attToUpsert = formData.attendance
        .filter(a => a.startDate)
        .map(a => {
          const payload = {
            user_id: currentUserProfile.id,
            type: a.type,
            start_date: a.startDate,
            end_date: a.endDate || a.startDate,
            time_option: a.timeOption
          }
          if (typeof a.id === 'string' && a.id.includes('-') && !a.id.startsWith('temp-')) {
            payload.id = a.id
          }
          return payload
        })
        
      if (attToUpsert.length > 0) {
        await supabase.from('attendance').upsert(attToUpsert)
      }

      // Refresh local data
      await fetchAllData()
      setIsModalOpen(false)
    } catch (error) {
      console.error('저장 중 오류 발생:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // Task Handlers
  const handleAddTask = () => setFormData(prev => ({...prev, coreTasks: [...prev.coreTasks, { id: Date.now(), status: '예정', text: '', deadline: '' }] }))
  const handleUpdateTask = (id, field, value) => setFormData(prev => ({...prev, coreTasks: prev.coreTasks.map(t => t.id === id ? { ...t, [field]: value } : t) }))
  const handleRemoveTask = (id) => setFormData(prev => ({...prev, coreTasks: prev.coreTasks.filter(t => t.id !== id) }))

  // Attendance Handlers
  const handleAddAttendance = () => setFormData(prev => ({...prev, attendance: [...prev.attendance, { id: Date.now().toString(), type: '자율출퇴근제', startDate: '', endDate: '', timeOption: '08:00~17:00' }] }))
  const handleUpdateAttendance = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      attendance: prev.attendance.map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, [field]: value };
        if (field === 'type') {
          if (value === '휴가') { updated.timeOption = '종일'; }
          else if (value === '반차') { updated.timeOption = '오전'; }
          else if (value === '자율출퇴근제') { updated.timeOption = '08:00~17:00'; }
        }
        if (field === 'startDate' && !updated.endDate) {
          updated.endDate = value;
        }
        return updated;
      })
    }))
  }
  const handleRemoveAttendance = (id) => setFormData(prev => ({...prev, attendance: prev.attendance.filter(a => a.id !== id) }))

  const handleDeleteComment = async (reportId, section) => {
    const col = section === 'tasks' ? 'tasks_comment' : 'bottlenecks_comment'
    const authorCol = section === 'tasks' ? 'tasks_comment_author_id' : 'bottlenecks_comment_author_id'
    const { data: existing } = await supabase
      .from('leader_comments')
      .select('id')
      .eq('report_id', reportId)
      .maybeSingle()
    if (existing) {
      await supabase.from('leader_comments')
        .update({ [col]: '', [authorCol]: null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    await fetchAllData()
  }

  const handleSaveNotice = async () => {
    await supabase.from('weeks').update({ team_notice: noticeText }).eq('id', currentWeek.id)
    setIsEditingNotice(false)
    fetchAllData()
  }

  const handleSaveComment = async () => {
    if (!editingComment) return
    setIsSavingComment(true)
    try {
      const col = editingComment.section === 'tasks' ? 'tasks_comment' : 'bottlenecks_comment'
      const { data: existing } = await supabase
        .from('leader_comments')
        .select('id')
        .eq('report_id', editingComment.reportId)
        .maybeSingle()
      const authorCol = editingComment.section === 'tasks' ? 'tasks_comment_author_id' : 'bottlenecks_comment_author_id'
      if (existing) {
        await supabase.from('leader_comments')
          .update({ [col]: editingComment.value, [authorCol]: currentUserProfile.id, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('leader_comments')
          .insert({ report_id: editingComment.reportId, [col]: editingComment.value, [authorCol]: currentUserProfile.id })
      }
      setEditingComment(null)
      await fetchAllData()
    } catch (e) {
      console.error('코멘트 저장 오류:', e)
    } finally {
      setIsSavingComment(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordChangeMessage('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }
    
    setIsSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsSaving(false)
    
    if (error) {
      setPasswordChangeMessage('변경 실패: ' + error.message)
    } else {
      setPasswordChangeMessage('비밀번호가 성공적으로 변경되었습니다.')
      setTimeout(() => {
        setIsPasswordModalOpen(false)
        setNewPassword('')
        setPasswordChangeMessage('')
      }, 1500)
    }
  }

  const renderCommentBlock = (report, section, hasContent) => {
    const commentText = section === 'tasks' ? report.leaderComment?.tasksComment : report.leaderComment?.bottlenecksComment
    const authorId = section === 'tasks' ? report.leaderComment?.tasksAuthorId : report.leaderComment?.bottlenecksAuthorId
    const isEditing = editingComment?.reportId === report.reportId && editingComment?.section === section
    const isAuthor = currentUserProfile.id === authorId
    const placeholder = section === 'tasks'
      ? '핵심 업무에 대한 코멘트를 입력하세요.'
      : '지원 필요 및 병목사항에 대한 코멘트를 입력하세요.'

    if (!report.reportId) return null
    if (!hasContent && !commentText) return null

    return (
      <div style={{
        marginTop: '10px', padding: '12px 14px',
        background: 'rgba(255, 156, 0, 0.04)',
        border: '1px solid rgba(255, 156, 0, 0.22)',
        borderRadius: 'var(--radius-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (commentText || isEditing) ? '8px' : '0' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--kbs-orange)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MessageSquare size={13} /> 코멘트
          </span>
          {!isEditing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isAuthor && commentText && (
                <button
                  onClick={() => { if (window.confirm('코멘트를 삭제할까요?')) handleDeleteComment(report.reportId, section) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-danger)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Trash2 size={11} /> 삭제
                </button>
              )}
              {hasContent && (
                <button
                  onClick={() => setEditingComment({ reportId: report.reportId, section, value: commentText || '' })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--kbs-orange)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Edit3 size={11} /> {commentText ? '수정' : '작성'}
                </button>
              )}
            </div>
          )}
        </div>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              className="form-input" rows={3}
              value={editingComment.value}
              onChange={e => setEditingComment({ ...editingComment, value: e.target.value })}
              placeholder={placeholder}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.82rem' }} onClick={() => setEditingComment(null)}>취소</button>
              <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleSaveComment} disabled={isSavingComment}>
                {isSavingComment ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={13} /> 저장</>}
              </button>
            </div>
          </div>
        ) : commentText ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {commentText}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
            코멘트를 작성해 주세요.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-container animate-fade-in">
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div 
          onClick={() => jumpToCurrentWeek()} 
          style={{ cursor: 'pointer', transition: 'opacity 0.2s', display: 'inline-block' }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          title="이번 주 화면으로 돌아가기"
        >
          <h1 style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
            <img src="/images/logo.png" alt="KBS Media" style={{ height: '45px', objectFit: 'contain' }} />
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '10px', fontWeight: '500' }}>
            전략기획부 정책기획팀 주간 업무 및 근태 현황
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '600', color: 'var(--kbs-navy)' }}>{currentUserProfile.name} 님</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{isTeamLeader ? '팀장' : '정책기획팀'}</div>
          </div>
          <img 
            src={currentUserProfile.profile_img || "/images/logo.png"} 
            alt={currentUserProfile.name} 
            style={{ 
              width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover',
              boxShadow: '0 4px 15px rgba(34, 130, 185, 0.2)', border: '2px solid white'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setIsPasswordModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> 비밀번호 변경
              </button>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LogOut size={12} /> 로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Week Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'var(--bg-glass)', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <button className="btn btn-secondary" onClick={handlePrevWeek} disabled={currentWeekIndex === weeksData.length - 1}>
          <ChevronLeft size={20} /> 이전 주
        </button>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--kbs-navy)', margin: 0 }}>{currentWeek.title}</h2>
          </div>
          <div style={{ color: 'var(--kbs-blue)', fontWeight: '600', fontSize: '0.95rem' }}>{currentWeek.date_str}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleNextWeek}>
            다음 주 <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Guidelines Accordion */}
      <div className="glass-panel" style={{ marginBottom: '2rem', overflow: 'hidden' }}>
        <button 
          onClick={() => setShowGuidelines(!showGuidelines)}
          style={{ width: '100%', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel-header)', border: 'none', cursor: 'pointer', color: 'var(--kbs-navy)', fontWeight: '600', fontSize: '1.05rem', transition: 'var(--transition)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={20} color="var(--kbs-blue)" />
            운영 가이드라인 및 작성 수칙 (필독)
          </div>
          <div style={{ transform: showGuidelines ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }}>▼</div>
        </button>
        
        {showGuidelines && (
          <div style={{ padding: '1.5rem', background: 'var(--bg-glass)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {GUIDELINES.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ 
                  background: 'rgba(34, 130, 185, 0.1)', color: 'var(--kbs-blue)', width: '24px', height: '24px', 
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0
                }}>
                  {index + 1}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--kbs-navy)', fontSize: '0.95rem' }}>{item.title}</h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Notice */}
      <div className="glass-panel animate-fade-in" style={{ marginBottom: '2rem', background: 'linear-gradient(to right, rgba(34, 130, 185, 0.05), transparent)', borderLeft: '4px solid var(--kbs-blue)' }}>
        <div style={{ padding: '1.2rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--kbs-navy)', fontSize: '1.05rem', margin: 0 }}>
              <Megaphone size={18} color="var(--kbs-blue)" />
              팀 공지사항
            </h3>
            {isTeamLeader && !isEditingNotice && (
              <button onClick={() => { setNoticeText(currentWeek.team_notice || ''); setIsEditingNotice(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--kbs-blue)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                <Edit3 size={14} /> 공지 수정
              </button>
            )}
          </div>
          
          {isEditingNotice ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea className="form-input" rows={3} value={noticeText} onChange={e => setNoticeText(e.target.value)} style={{ resize: 'vertical' }} placeholder="공지사항을 입력하세요." />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setIsEditingNotice(false)} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>취소</button>
                <button className="btn btn-primary" onClick={handleSaveNotice} style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={14} /> 저장</button>
              </div>
            </div>
          ) : (
            <>
              {currentWeek.team_notice ? (
                <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {currentWeek.team_notice}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  등록된 공지사항이 없습니다.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reports List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {weekReports.map(report => (
          <div key={report.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {report.profileImg ? (
                  <img src={report.profileImg} alt={report.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-icon-wrapper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}><User size={20} color="var(--kbs-blue)" /></div>
                )}
                <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--kbs-navy)' }}>{report.name}</h3>
              </div>
              {currentUserProfile && currentUserProfile.id === report.id && (
                <button 
                  className="btn btn-primary" 
                  onClick={handleOpenModal} 
                  style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit3 size={14} /> 내 현황 작성
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
              {/* Attendance Badges */}
              {report.attendance && report.attendance.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {report.attendance.map(att => renderAttendanceBadge(att))}
                </div>
              )}

              {/* Core Tasks */}
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--kbs-navy)', fontSize: '1rem' }}>
                  <Target size={18} color="var(--status-success)" /> 핵심 업무 (Action Item)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  {Array.isArray(report.coreTasks) && report.coreTasks.length > 0 ? (
                    report.coreTasks.map(task => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ 
                          fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                          background: task.status === '완료' ? 'rgba(16, 185, 129, 0.15)' : task.status === '진행' ? 'rgba(34, 130, 185, 0.15)' : task.status === '지연' ? 'rgba(255, 156, 0, 0.15)' : 'rgba(100, 116, 139, 0.1)',
                          color: task.status === '완료' ? '#10b981' : task.status === '진행' ? 'var(--kbs-blue)' : task.status === '지연' ? '#c2410c' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap', marginTop: '2px', border: '1px solid',
                          borderColor: task.status === '완료' ? 'rgba(16, 185, 129, 0.3)' : task.status === '진행' ? 'rgba(34, 130, 185, 0.3)' : task.status === '지연' ? 'rgba(255, 156, 0, 0.3)' : 'rgba(100, 116, 139, 0.2)'
                        }}>{task.status}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.4, fontWeight: '500', wordBreak: 'keep-all', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>{task.text}</div>
                          {task.deadline && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={12} /> 완료 예정 기한: {formatDateShort(task.deadline)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>등록된 업무가 없습니다.</span>}
                </div>

                {renderCommentBlock(report, 'tasks', Array.isArray(report.coreTasks) && report.coreTasks.length > 0)}
              </div>

              {/* Bottlenecks */}
              {(report.bottlenecks || report.leaderComment?.bottlenecksComment) && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--status-danger)', fontSize: '1rem' }}>
                    <AlertTriangle size={18} /> 지원 필요 및 병목사항
                  </h4>
                  {report.bottlenecks && (
                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--status-danger)', fontSize: '0.95rem', lineHeight: 1.6, padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      {report.bottlenecks}
                    </div>
                  )}
                  {renderCommentBlock(report, 'bottlenecks', !!report.bottlenecks)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Attendance Calendar */}
      {weeklyCalendarData && weeklyCalendarData.length > 0 && (
        <div className="glass-panel animate-fade-in" style={{ marginTop: '2rem', marginBottom: '4rem', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', background: 'var(--bg-panel-header)', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--kbs-navy)', fontSize: '1.2rem', margin: 0 }}>
              <Calendar size={22} color="var(--kbs-blue)" /> 주간 근태 종합 현황
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--border-color)' }}>
            {weeklyCalendarData.map((dayItem, i) => (
              <div key={i} style={{ background: 'var(--bg-glass)', display: 'flex', flexDirection: 'column', minHeight: '150px' }}>
                <div style={{ 
                  padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', fontWeight: '700',
                  color: dayItem.day === '일' ? '#ef4444' : dayItem.day === '토' ? 'var(--kbs-blue)' : 'var(--kbs-navy)',
                  background: 'var(--bg-icon-wrapper)'
                }}>
                  <div style={{ fontSize: '1.1rem' }}>{dayItem.date}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({dayItem.day})</div>
                </div>
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {dayItem.events.map((ev, j) => (
                    <div key={j} style={{ 
                      padding: '8px', borderRadius: '6px', 
                      background: ev.type === '휴가' ? 'rgba(239, 68, 68, 0.08)' : ev.type === '반차' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 130, 185, 0.08)',
                      border: '1px solid',
                      borderColor: ev.type === '휴가' ? 'rgba(239, 68, 68, 0.2)' : ev.type === '반차' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 130, 185, 0.2)',
                    }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--kbs-navy)' }}>{ev.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', justifyContent: 'space-between', fontWeight: '500' }}>
                        <span style={{ color: ev.type === '휴가' ? '#dc2626' : ev.type === '반차' ? '#d97706' : 'var(--kbs-blue)' }}>{ev.type}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span>{ev.time}</span>
                          {ev.type === '휴가' && ev.startDate && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--status-danger)', fontWeight: '600' }}>
                              ({new Date(ev.startDate).getMonth()+1}.{new Date(ev.startDate).getDate()}{ev.endDate && ev.startDate !== ev.endDate ? `~${new Date(ev.endDate).getMonth()+1}.${new Date(ev.endDate).getDate()}` : ''})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {dayItem.events.length === 0 && <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.8rem', marginTop: '1rem' }}>일정 없음</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--kbs-navy)' }}>
                <Target size={24} color="var(--kbs-blue)" /> {currentWeek.title}({currentWeek.date_str}) 현황 작성
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {/* Core Tasks */}
              <div>
                <label className="form-label">1. 핵심 업무 (Action Item)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {formData.coreTasks.map((task) => (
                    <div key={task.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select className="form-input" style={{ width: '100px' }} value={task.status} onChange={e => handleUpdateTask(task.id, 'status', e.target.value)}>
                        <option value="진행">진행</option>
                        <option value="완료">완료</option>
                        <option value="지연">지연</option>
                        <option value="예정">예정</option>
                      </select>
                      <input type="text" className="form-input" placeholder="실행 중심의 구체적인 업무 내용 입력" value={task.text} onChange={e => handleUpdateTask(task.id, 'text', e.target.value)} style={{ flex: 1 }} />
                      <input type="date" className="form-input" value={task.deadline || ''} onChange={e => handleUpdateTask(task.id, 'deadline', e.target.value)} style={{ width: '145px' }} />
                      <button onClick={() => handleRemoveTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-danger)', padding: '5px' }} disabled={formData.coreTasks.length === 1}><Trash2 size={20} /></button>
                    </div>
                  ))}
                  <button onClick={handleAddTask} style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px', background: 'var(--bg-icon-wrapper)', border: '1px dashed var(--kbs-blue)', color: 'var(--kbs-blue)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600', justifyContent: 'center' }}>
                    <Plus size={18} /> 항목 추가하기
                  </button>
                </div>
              </div>

              {/* Attendance Section */}
              <div>
                <label className="form-label">2. 이번 주 근태 및 일정 사전 공유</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {formData.attendance.map(att => (
                    <div key={att.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--bg-panel-header)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <select className="form-input" style={{ width: '130px' }} value={att.type} onChange={e => handleUpdateAttendance(att.id, 'type', e.target.value)}>
                        <option value="휴가">휴가</option>
                        <option value="반차">반차</option>
                        <option value="자율출퇴근제">자율출퇴근제</option>
                      </select>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input type="date" className="form-input" value={att.startDate} onChange={e => handleUpdateAttendance(att.id, 'startDate', e.target.value)} />
                        {(att.type === '휴가' || att.type === '자율출퇴근제') && (
                          <>
                            <span style={{ color: 'var(--text-muted)' }}>~</span>
                            <input type="date" className="form-input" value={att.endDate} onChange={e => handleUpdateAttendance(att.id, 'endDate', e.target.value)} />
                          </>
                        )}
                      </div>

                      {att.type === '자율출퇴근제' && (
                        <select className="form-input" style={{ width: '130px' }} value={att.timeOption} onChange={e => handleUpdateAttendance(att.id, 'timeOption', e.target.value)}>
                          <option value="07:00~16:00">07:00~16:00</option>
                          <option value="08:00~17:00">08:00~17:00</option>
                          <option value="10:00~19:00">10:00~19:00</option>
                        </select>
                      )}
                      {att.type === '반차' && (
                        <select className="form-input" style={{ width: '100px' }} value={att.timeOption} onChange={e => handleUpdateAttendance(att.id, 'timeOption', e.target.value)}>
                          <option value="오전">오전</option>
                          <option value="오후">오후</option>
                        </select>
                      )}

                      <button onClick={() => handleRemoveAttendance(att.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-danger)', padding: '5px', marginLeft: 'auto' }}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  <button onClick={handleAddAttendance} style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px', background: 'var(--bg-icon-wrapper)', border: '1px dashed var(--kbs-blue)', color: 'var(--kbs-blue)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600', justifyContent: 'center' }}>
                    <Plus size={18} /> 근태 일정 추가하기
                  </button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  * 휴가 일정이 다음 주까지 이어지는 경우, 해당하는 전체 기간을 선택하면 다음 주 현황에도 자동으로 반영됩니다.
                </p>
              </div>

              {/* Bottlenecks */}
              <div>
                <label className="form-label">3. 지원 필요 및 병목사항</label>
                <textarea className="form-input" rows={3} placeholder="타 부서 협조 지연, 데이터 권한 등 팀 차원의 조율/지원이 필요한 사항을 투명하게 적어주세요." value={formData.bottlenecks} onChange={e => setFormData({...formData, bottlenecks: e.target.value})} style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSaveReport} disabled={isSaving}>
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsPasswordModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>비밀번호 변경</h2>
              <button className="close-btn" onClick={() => setIsPasswordModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>새 비밀번호</label>
              <input 
                type="password" 
                className="form-input" 
                value={newPassword} 
                onChange={(e) => { setNewPassword(e.target.value); setPasswordChangeMessage(''); }}
                placeholder="새로운 비밀번호 (최소 6자)"
                style={{ width: '100%', marginBottom: '10px' }}
              />
              
              {passwordChangeMessage && (
                <div style={{ 
                  color: passwordChangeMessage.includes('성공') ? '#10b981' : '#ef4444', 
                  fontSize: '0.85rem', 
                  marginBottom: '10px',
                  background: passwordChangeMessage.includes('성공') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '8px',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  {passwordChangeMessage}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsPasswordModalOpen(false)}>
                  취소
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdatePassword} disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : '변경하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
