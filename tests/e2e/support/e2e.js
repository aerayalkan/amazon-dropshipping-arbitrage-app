// Import commands
import './commands'

// Import test coverage
import '@cypress/code-coverage/support'

// Configure Cypress
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // on uncaught exceptions. We want to handle them manually.
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  return true
})

// Add custom commands
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.visit('/auth/login')
    cy.get('[data-cy=email-input]').type(email)
    cy.get('[data-cy=password-input]').type(password)
    cy.get('[data-cy=login-button]').click()
    cy.url().should('include', '/dashboard')
    cy.window().its('localStorage.accessToken').should('exist')
  })
})

Cypress.Commands.add('logout', () => {
  cy.window().then((win) => {
    win.localStorage.clear()
    win.sessionStorage.clear()
  })
  cy.visit('/auth/login')
})

Cypress.Commands.add('seedData', (type, data) => {
  cy.task('seedDatabase', { type, data })
})

Cypress.Commands.add('cleanData', () => {
  cy.task('cleanDatabase')
})

// Before each test
beforeEach(() => {
  // Clear local storage
  cy.clearLocalStorage()
  cy.clearCookies()
  
  // Set viewport
  cy.viewport(1280, 720)
  
  // Intercept API calls
  cy.intercept('GET', '/api/health', { fixture: 'health.json' }).as('healthCheck')
  cy.intercept('POST', '/api/auth/login', { fixture: 'auth/login.json' }).as('login')
  cy.intercept('GET', '/api/dashboard/stats', { fixture: 'dashboard/stats.json' }).as('dashboardStats')
})

// After each test
afterEach(() => {
  // Take screenshot on failure
  cy.screenshot({ capture: 'runner', onlyOnFailure: true })
})