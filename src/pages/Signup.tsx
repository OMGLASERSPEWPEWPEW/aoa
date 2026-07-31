import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const inputStyle: React.CSSProperties = {
  backgroundColor: '#141109',
  border: '1px solid #2b2720',
  borderRadius: 3,
  padding: '12px 16px',
  color: 'var(--ink)',
  fontFamily: "'Courier Prime', monospace",
  fontSize: 13,
  width: '100%',
  outline: 'none',
}

export function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/app')
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
    >
      <h1
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 24,
          fontWeight: 400,
          marginBottom: 24,
        }}
      >
        Create Account
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full" style={{ maxWidth: 280 }}>
        {error && <p style={{ color: 'oklch(0.66 0.19 35)', fontSize: 13, textAlign: 'center' }}>{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          required
        />
        <input
          type="password"
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: 'oklch(0.80 0.14 55)',
            color: '#0c0a05',
            fontFamily: "'Newsreader', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 15,
            padding: '14px 24px',
            borderRadius: 3,
            border: 'none',
            cursor: 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Creating account...' : 'Get Started'}
        </button>
      </form>
      <p style={{ color: '#625b4c', fontSize: 13, marginTop: 24, fontFamily: "'Courier Prime', monospace" }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'oklch(0.80 0.14 55)', textDecoration: 'none' }}>Sign in</Link>
      </p>
      <Link to="/" style={{ color: '#4f4a3e', fontSize: 12, marginTop: 16, textDecoration: 'none', fontFamily: "'Courier Prime', monospace" }}>
        &larr; Back
      </Link>
    </div>
  )
}
