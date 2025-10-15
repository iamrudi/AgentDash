# Contributing to Agency Client Portal

Thank you for your interest in contributing to the Agency Client Portal! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Security](#security)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and constructive in discussions
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards others

## Getting Started

### Prerequisites

- Node.js >= 20.x
- PostgreSQL >= 14.x or Supabase account
- Google Cloud account (for integrations)
- Git

### Setup Development Environment

1. **Fork and clone the repository:**
   \`\`\`bash
   git clone https://github.com/your-username/agency-portal.git
   cd agency-portal
   \`\`\`

2. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure environment:**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your credentials
   \`\`\`

4. **Setup database:**
   \`\`\`bash
   npm run db:push
   \`\`\`

5. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features (e.g., `feature/add-payment-integration`)
- `fix/` - Bug fixes (e.g., `fix/authentication-error`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/optimize-queries`)
- `test/` - Test additions/updates (e.g., `test/add-auth-tests`)

### Development Process

1. **Create a feature branch:**
   \`\`\`bash
   git checkout -b feature/your-feature-name
   \`\`\`

2. **Make your changes:**
   - Write code following our [coding standards](#coding-standards)
   - Add tests for new functionality
   - Update documentation as needed

3. **Run checks locally:**
   \`\`\`bash
   npm run check        # TypeScript type checking
   npm run lint         # ESLint
   npm run format       # Prettier formatting
   npm run test         # Run tests
   \`\`\`

4. **Commit your changes:**
   - Follow [commit guidelines](#commit-guidelines)
   - Keep commits atomic and focused

5. **Push and create PR:**
   \`\`\`bash
   git push origin feature/your-feature-name
   \`\`\`

## Coding Standards

### TypeScript

- **Strict mode**: Use TypeScript strict mode
- **Types**: Always define explicit types, avoid `any`
- **Interfaces**: Use interfaces for object shapes
- **Enums**: Use enums for fixed sets of values

\`\`\`typescript
// Good
interface User {
  id: number;
  email: string;
  role: 'admin' | 'staff' | 'client';
}

// Bad
const user: any = { ... };
\`\`\`

### Validation

- **Zod schemas**: Use Zod for all input validation
- **Error handling**: Always validate before database operations

\`\`\`typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

const validated = schema.parse(input);
\`\`\`

### Database

- **Drizzle ORM**: Use Drizzle for all database operations
- **Schema first**: Define schema in `shared/schema.ts`
- **Migrations**: Run `npm run db:generate` for migrations
- **Never change ID types**: See database safety rules in README

### Frontend

- **React**: Use functional components and hooks
- **TanStack Query**: Use for all data fetching
- **Tailwind**: Use Tailwind CSS for styling
- **Shadcn/UI**: Use existing components when possible

### Security

- **No secrets in code**: Use environment variables
- **Input validation**: Validate all user inputs
- **SQL injection**: Use parameterized queries (Drizzle handles this)
- **XSS prevention**: Sanitize user-generated content
- **CSRF protection**: Use CSRF tokens for state-changing operations

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

\`\`\`bash
feat(auth): add Google OAuth integration

Implement Google OAuth 2.0 authentication flow with secure token storage
and automatic refresh mechanism.

Closes #123
\`\`\`

\`\`\`bash
fix(api): resolve CORS issue for production domain

Updated CORS configuration to allow requests from production domain
with proper credentials handling.

Fixes #456
\`\`\`

## Pull Request Process

### Before Submitting

1. **Rebase on main:**
   \`\`\`bash
   git fetch origin
   git rebase origin/main
   \`\`\`

2. **Run all checks:**
   \`\`\`bash
   npm run check
   npm run lint
   npm run test
   \`\`\`

3. **Update documentation:**
   - Update README if adding features
   - Add JSDoc comments for new functions
   - Update API documentation if needed

### PR Template

Use this template for your PR description:

\`\`\`markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2

## Testing
Describe how you tested your changes

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No new warnings
\`\`\`

### Review Process

1. **Automated checks**: CI must pass
2. **Code review**: At least one approval required
3. **Testing**: Verify functionality works as expected
4. **Documentation**: Ensure docs are updated

## Testing Guidelines

### Unit Tests

- Write tests for all new functions
- Test edge cases and error conditions
- Use descriptive test names

\`\`\`typescript
describe('calculateTotal', () => {
  it('should calculate total with tax', () => {
    const result = calculateTotal(100, 0.1);
    expect(result).toBe(110);
  });

  it('should handle zero tax rate', () => {
    const result = calculateTotal(100, 0);
    expect(result).toBe(100);
  });
});
\`\`\`

### Integration Tests

- Test API endpoints with supertest
- Mock external services
- Test authentication flows

### E2E Tests

- Test critical user journeys
- Use Playwright for browser testing
- Test across different roles

## Security

### Reporting Vulnerabilities

**Do not** open public issues for security vulnerabilities.

Instead:
1. Email: security@agencyportal.com
2. Include detailed description
3. Provide steps to reproduce
4. Suggest a fix if possible

See [SECURITY.md](./SECURITY.md) for more details.

### Security Best Practices

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Validate all inputs
- Use prepared statements (Drizzle does this)
- Implement proper authentication and authorization
- Keep dependencies updated

## Questions?

- **Discord**: Join our [Discord community](#)
- **Email**: developers@agencyportal.com
- **GitHub Discussions**: Use for general questions

---

Thank you for contributing to Agency Client Portal! 🎉
