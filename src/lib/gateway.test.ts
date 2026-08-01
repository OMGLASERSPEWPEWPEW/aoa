import { callModel } from './gateway'
import { supabase } from './__mocks__/supabase'

vi.mock('./supabase', () => import('./__mocks__/supabase'))

const mockSession = {
  access_token: 'test-token',
  user: { id: 'user-1' },
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  } as never)
})

describe('callModel', () => {
  it('throws when not authenticated', async () => {
    await expect(
      callModel({ messages: [{ role: 'user', content: 'hello' }] }),
    ).rejects.toThrow('Not authenticated')
  })

  it('sends correct payload to ai-gateway', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
    } as never)

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'response' }),
    } as Response)

    await callModel({ messages: [{ role: 'user', content: 'hello' }] })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/ai-gateway',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string)
    expect(body.provider).toBe('anthropic')
    expect(body.model).toBe('claude-sonnet-4-20250514')
    expect(body.maxTokens).toBe(1024)
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
  })

  it('returns text from response', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
    } as never)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'hello back' }),
    } as Response)

    const result = await callModel({
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(result.text).toBe('hello back')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
    } as never)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('bad request'),
    } as Response)

    await expect(
      callModel({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('AI Gateway error: bad request')
  })

  it('applies custom options', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
    } as never)

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: '' }),
    } as Response)

    await callModel({
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'you are helpful',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 2048,
      temperature: 0.7,
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string)
    expect(body.provider).toBe('openai')
    expect(body.model).toBe('gpt-4o')
    expect(body.system).toBe('you are helpful')
    expect(body.maxTokens).toBe(2048)
    expect(body.temperature).toBe(0.7)
  })
})
