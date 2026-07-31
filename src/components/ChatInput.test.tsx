import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  it('renders input and submit button', () => {
    render(<ChatInput onSend={vi.fn()} />)
    expect(screen.getByPlaceholderText('Ask your mentor anything...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onSend with trimmed text on submit', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()

    render(<ChatInput onSend={onSend} />)
    const input = screen.getByPlaceholderText('Ask your mentor anything...')

    await user.type(input, '  hello world  ')
    await user.click(screen.getByRole('button'))

    expect(onSend).toHaveBeenCalledWith('hello world')
    expect(input).toHaveValue('')
  })

  it('does not send empty messages', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()

    render(<ChatInput onSend={onSend} />)
    await user.click(screen.getByRole('button'))

    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send whitespace-only messages', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()

    render(<ChatInput onSend={onSend} />)
    await user.type(screen.getByPlaceholderText('Ask your mentor anything...'), '   ')
    await user.click(screen.getByRole('button'))

    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables button when input is empty', () => {
    render(<ChatInput onSend={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables input and button when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled />)
    expect(screen.getByPlaceholderText('Ask your mentor anything...')).toBeDisabled()
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
