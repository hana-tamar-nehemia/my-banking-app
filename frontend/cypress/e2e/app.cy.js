describe('Banking App', () => {
  it('loads the home page without crashing', () => {
    cy.visit('/');

    cy.contains('h1', 'Get a card you can control with transparency').should(
      'be.visible'
    );
    cy.contains('button', 'Login').should('be.visible');
    cy.contains('h2', 'Your money, clearly.').should('be.visible');
  });

  it('shows the login form on the login page', () => {
    cy.visit('/login');

    cy.contains('h2', 'Welcome back').should('be.visible');
    cy.contains('Sign in to your account').should('be.visible');
    cy.get('#login-email').should('be.visible');
    cy.get('#login-password').should('be.visible');
    cy.contains('button', 'Log in').should('be.visible');
  });
});
