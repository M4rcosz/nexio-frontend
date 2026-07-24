// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { Markdown } from './Markdown'

afterEach(cleanup)

describe('Markdown', () => {
  it('renders a bulleted list with bold labels instead of raw asterisks', () => {
    const { container } = render(
      <Markdown
        text={[
          'Aqui estão as nossas unidades de negócio:',
          '',
          '*   **Ark Drinks** (Cidade: Araguari)',
          '*   **Rainbow Flavors** (Cidade: Uberlândia)',
        ].join('\n')}
      />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Ark Drinks').tagName).toBe('STRONG')
    expect(items[0]).toHaveTextContent('Ark Drinks (Cidade: Araguari)')
    expect(container.textContent).not.toContain('*')
  })

  it('numbers an ordered list from its first marker', () => {
    render(<Markdown text={'3. third\n4. fourth'} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
    expect(list).toHaveAttribute('start', '3')
  })

  it('renders headings, inline code and emphasis', () => {
    render(<Markdown text={'## Pedidos\n\nUse `GET /orders` para _listar_.'} />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pedidos' }),
    ).toBeInTheDocument()
    expect(screen.getByText('GET /orders').tagName).toBe('CODE')
    expect(screen.getByText('listar').tagName).toBe('EM')
  })

  it('keeps fenced code verbatim', () => {
    const { container } = render(
      <Markdown text={'```json\n{ "a": **1** }\n```'} />,
    )
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toBe('{ "a": **1** }')
  })

  it('renders a pipe table', () => {
    render(
      <Markdown
        text={'| Unidade | Cidade |\n| --- | --- |\n| Ark | Araguari |'}
      />,
    )
    const table = within(screen.getByRole('table'))
    expect(table.getByRole('columnheader', { name: 'Unidade' })).toBeVisible()
    expect(table.getByRole('cell', { name: 'Araguari' })).toBeVisible()
  })

  it('leaves underscores inside identifiers alone', () => {
    render(<Markdown text="O campo business_unit_id é obrigatório." />)
    expect(
      screen.getByText(/O campo business_unit_id é obrigatório\./),
    ).toBeInTheDocument()
  })

  it('links http urls and drops unsafe schemes', () => {
    render(
      <Markdown
        text={'[docs](https://nexio.test/docs) e [x](javascript:alert(1))'}
      />,
    )
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).toHaveAttribute('href', 'https://nexio.test/docs')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('link', { name: 'x' })).toBeNull()
    expect(screen.getByText('x')).toBeInTheDocument()
  })

  it('does not interpret html in a reply', () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror="alert(1)">'} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })

  it('preserves single newlines inside a paragraph', () => {
    const { container } = render(<Markdown text={'linha um\nlinha dois'} />)
    const p = container.querySelector('p')
    expect(p?.textContent).toBe('linha um\nlinha dois')
  })
})
