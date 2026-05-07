import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Mail, Lock, Loader2, ArrowRight, CheckCircle2, User } from 'lucide-react'

export default function Auth({ view = 'login' }) {
  const [currentView, setCurrentView] = useState(view) // 'login', 'forgot_password', 'update_password'
  const [employeeId, setEmployeeId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // URL 해시에 access_token이 있고 type=recovery 인 경우 비밀번호 변경 화면으로 전환
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCurrentView('update_password')
      }
    })
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    
    // 사번 -> 이메일 변환 매핑
    const EMAIL_MAP = {
      '10319': 'sjpark@kbsmedia.co.kr',
      '10181': 'yooj@kbsmedia.co.kr',
      '10212': 'sungeun@kbsmedia.co.kr',
      '10227': 'kyh@kbsmedia.co.kr',
      '10270': 'jessie@kbsmedia.co.kr'
    }
    const loginEmail = EMAIL_MAP[employeeId] || `${employeeId}@kbsmedia.co.kr`
    
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    if (error) {
      setError('사번 또는 비밀번호가 올바르지 않습니다.')
    }
    setLoading(false)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('비밀번호 재설정 링크가 이메일로 발송되었습니다. 이메일을 확인해 주세요.')
    }
    setLoading(false)
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('비밀번호 변경에 실패했습니다: ' + error.message)
    } else {
      setMessage('비밀번호가 성공적으로 변경되었습니다! 이제 대시보드를 이용할 수 있습니다.')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-body)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <img src="/images/logo.png" alt="KBS Media" style={{ height: '40px', marginBottom: '1rem' }} />
          <h2 style={{ margin: 0, color: 'var(--kbs-navy)', fontSize: '1.4rem' }}>
            {currentView === 'login' ? '정책기획팀 워크스페이스' : 
             currentView === 'forgot_password' ? '비밀번호 찾기' : '새 비밀번호 설정'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
            {currentView === 'login' ? '사내 공용 계정으로 로그인해 주세요.' : 
             currentView === 'forgot_password' ? '가입된 사내 이메일을 입력하시면 재설정 링크를 보내드립니다.' : 
             '앞으로 사용할 새로운 비밀번호를 입력해 주세요.'}
          </p>
        </div>

        {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
        {message && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><CheckCircle2 size={18} /> {message}</div>}

        {currentView === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>사번 (ID)</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" required value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="form-input" style={{ paddingLeft: '38px', width: '100%' }} placeholder="사번을 입력하세요" />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>비밀번호</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="form-input" style={{ paddingLeft: '38px', width: '100%' }} placeholder="비밀번호를 입력하세요" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1rem' }} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : '로그인'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button type="button" onClick={() => setCurrentView('forgot_password')} style={{ background: 'none', border: 'none', color: 'var(--kbs-blue)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>
                비밀번호를 잊으셨나요?
              </button>
            </div>
          </form>
        )}

        {currentView === 'forgot_password' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>이메일</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="form-input" style={{ paddingLeft: '38px', width: '100%' }} placeholder="가입된 이메일 입력" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1rem' }} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : '재설정 링크 받기'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button type="button" onClick={() => setCurrentView('login')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', margin: '0 auto' }}>
                <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> 로그인 화면으로 돌아가기
              </button>
            </div>
          </form>
        )}

        {currentView === 'update_password' && (
          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>새 비밀번호</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="form-input" style={{ paddingLeft: '38px', width: '100%' }} placeholder="새로운 비밀번호 입력 (최소 6자)" minLength={6} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1rem' }} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : '비밀번호 변경하기'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
