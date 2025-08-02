// Custom Cypress commands

// Authentication commands
Cypress.Commands.add('loginViaAPI', (email, password) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login`,
    body: { email, password },
  }).then((response) => {
    const { accessToken, refreshToken } = response.body.data
    window.localStorage.setItem('accessToken', accessToken)
    window.localStorage.setItem('refreshToken', refreshToken)
  })
})

// Data manipulation commands
Cypress.Commands.add('createProduct', (productData) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/products`,
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('accessToken')}`,
    },
    body: productData,
  })
})

Cypress.Commands.add('createInventoryItem', (inventoryData) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/inventory`,
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('accessToken')}`,
    },
    body: inventoryData,
  })
})

// UI interaction commands
Cypress.Commands.add('selectFromDropdown', (selector, option) => {
  cy.get(selector).click()
  cy.get(`[data-value="${option}"]`).click()
})

Cypress.Commands.add('uploadFile', (selector, fileName) => {
  cy.get(selector).selectFile(`tests/e2e/fixtures/files/${fileName}`)
})

Cypress.Commands.add('waitForLoading', () => {
  cy.get('[data-cy=loading]', { timeout: 10000 }).should('not.exist')
})

Cypress.Commands.add('checkToast', (type, message) => {
  cy.get(`[data-cy=toast-${type}]`).should('contain', message)
})

// Table interaction commands
Cypress.Commands.add('sortTable', (column, direction = 'asc') => {
  cy.get(`[data-cy=table-header-${column}]`).click()
  if (direction === 'desc') {
    cy.get(`[data-cy=table-header-${column}]`).click()
  }
})

Cypress.Commands.add('filterTable', (column, value) => {
  cy.get(`[data-cy=table-filter-${column}]`).type(value)
  cy.get(`[data-cy=table-filter-apply]`).click()
})

Cypress.Commands.add('selectTableRow', (rowIndex) => {
  cy.get(`[data-cy=table-row-${rowIndex}] input[type=checkbox]`).check()
})

// Form commands
Cypress.Commands.add('fillForm', (formData) => {
  Object.keys(formData).forEach((field) => {
    const value = formData[field]
    if (typeof value === 'boolean') {
      if (value) {
        cy.get(`[data-cy=${field}]`).check()
      } else {
        cy.get(`[data-cy=${field}]`).uncheck()
      }
    } else {
      cy.get(`[data-cy=${field}]`).type(value.toString())
    }
  })
})

Cypress.Commands.add('submitForm', (formSelector = 'form') => {
  cy.get(`[data-cy=${formSelector}]`).submit()
})

// Navigation commands
Cypress.Commands.add('navigateTo', (path) => {
  cy.get(`[data-cy=nav-${path}]`).click()
  cy.url().should('include', path)
})

// Wait commands
Cypress.Commands.add('waitForAPI', (alias) => {
  cy.wait(`@${alias}`)
})

Cypress.Commands.add('waitForChart', () => {
  cy.get('[data-cy=chart-loading]', { timeout: 15000 }).should('not.exist')
  cy.get('[data-cy=chart-container]').should('be.visible')
})

// Assertion commands
Cypress.Commands.add('shouldHaveData', (selector, count) => {
  cy.get(selector).should('have.length.at.least', count)
})

Cypress.Commands.add('shouldContainText', (selector, text) => {
  cy.get(selector).should('contain.text', text)
})

Cypress.Commands.add('shouldBeVisible', (selector) => {
  cy.get(selector).should('be.visible')
})

Cypress.Commands.add('shouldNotExist', (selector) => {
  cy.get(selector).should('not.exist')
})