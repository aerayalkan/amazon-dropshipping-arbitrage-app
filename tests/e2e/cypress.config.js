const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'tests/e2e/support/e2e.js',
    specPattern: 'tests/e2e/specs/**/*.cy.{js,ts}',
    fixturesFolder: 'tests/e2e/fixtures',
    screenshotsFolder: 'tests/e2e/screenshots',
    videosFolder: 'tests/e2e/videos',
    downloadsFolder: 'tests/e2e/downloads',
    
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Test isolation
    testIsolation: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0,
    },
    
    // Video recording
    video: true,
    videoCompression: 32,
    
    // Screenshots
    screenshotOnRunFailure: true,
    
    // Environment variables
    env: {
      apiUrl: 'http://localhost:3001',
      testUser: {
        email: 'test@example.com',
        password: 'Test123!@#',
      },
    },
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
      
      // Task for seeding test data
      on('task', {
        async seedDatabase() {
          // Seed test data
          return null
        },
        
        async cleanDatabase() {
          // Clean test data
          return null
        },
        
        async createTestUser(userData) {
          // Create test user
          return userData
        },
        
        log(message) {
          console.log(message)
          return null
        },
      })
      
      // Plugin for test coverage
      require('@cypress/code-coverage/task')(on, config)
      
      return config
    },
  },
  
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    supportFile: 'tests/e2e/support/component.js',
    specPattern: 'src/**/*.cy.{js,ts,jsx,tsx}',
  },
})