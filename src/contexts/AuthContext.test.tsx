import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '../lib/__mocks__/supabase'

vi.mock('../lib/supabase', () => import('../lib/__mocks__/supabase'))

function TestConsumer() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id ?? 'null'}</span>
      <button onClick={() => signIn('a@b.com', 'pw')}>signIn</button>
      <button onClick={() => signUp('a@b.com', 'pw')}>signUp</button>
      <button onClick={() => signOut()}>signOut</button>
    </div>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  } as never)
  vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
    data: {},
    error: null,
  } as never)
  vi.mocked(supabase.auth.signUp).mockResolvedValue({
    data: {},
    error: null,
  } as never)
  vi.mocked(supabase.auth.signOut).mockResolvedValue({
    error: null,
  } as never)
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as never)
})

describe('AuthContext', () => {
  it('starts loading then resolves to no user', async () => {
    render(
      <AuthProvider><TestConsumer /></AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })

  it('picks up existing session on mount', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: { user: { id: 'abc' }, access_token: 'tok' },
      },
    } as never)

    render(
      <AuthProvider><TestConsumer /></AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('abc')
    })
  })

  it('signIn calls supabase.auth.signInWithPassword', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider><TestConsumer /></AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    await user.click(screen.getByText('signIn'))
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
    })
  })

  it('signUp calls supabase.auth.signUp', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider><TestConsumer /></AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    await user.click(screen.getByText('signUp'))
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
    })
  })

  it('signOut calls supabase.auth.signOut', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider><TestConsumer /></AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    await user.click(screen.getByText('signOut'))
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider',
    )

    consoleSpy.mockRestore()
  })
})
