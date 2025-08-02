import { render, screen } from '@testing-library/react'
import Home from '../app/page'

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>
  }
})

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Home />)
    
    const heading = screen.getByText(/AI-Powered Amazon/i)
    expect(heading).toBeInTheDocument()
  })

  it('renders the dashboard link', () => {
    render(<Home />)
    
    const dashboardLink = screen.getByText(/Launch Dashboard/i)
    expect(dashboardLink).toBeInTheDocument()
  })

  it('renders feature cards', () => {
    render(<Home />)
    
    expect(screen.getByText(/Product Research/i)).toBeInTheDocument()
    expect(screen.getByText(/Inventory Management/i)).toBeInTheDocument()
    expect(screen.getByText(/Pricing Calculator/i)).toBeInTheDocument()
    expect(screen.getByText(/Repricing Engine/i)).toBeInTheDocument()
    expect(screen.getByText(/AI Analytics/i)).toBeInTheDocument()
  })

  it('renders statistics section', () => {
    render(<Home />)
    
    expect(screen.getByText(/Products Analyzed/i)).toBeInTheDocument()
    expect(screen.getByText(/Profit Generated/i)).toBeInTheDocument()
    expect(screen.getByText(/Accuracy Rate/i)).toBeInTheDocument()
  })
})