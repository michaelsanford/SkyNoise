# Contributing to SkyNoise

First of all, thank you for considering contributing to SkyNoise! It is contributors like you who make open source projects amazing.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behaviour privately.

---

## How Can I Contribute?

### 1. Reporting Bugs
Before filing a bug, please search existing issues to see if it has already been reported. If not, open a new issue using our [Bug Report Form](https://github.com/michaelsanford/SkyNoise/issues/new/choose).

Please include:
*   A clear description of the bug and the expected behavior.
*   Your device, browser, and OS version.
*   Your country location (mandatory for location-specific noise calculation scopes).

### 2. Suggesting Enhancements
Feature requests are welcomed! To suggest a feature, open an issue using our [Feature Request Form](https://github.com/michaelsanford/SkyNoise/issues/new/choose).

Please describe the problem you want to solve, your proposed solution, and any alternative solutions you considered.

### 3. Submitting Pull Requests (PRs)
To submit code changes:

#### Branch Naming
Always make changes on a branch following the Conventional Branch 1.1.0 specification:
*   **Format**: `<type>/<description>`
*   **Types**:
    *   `feat/` (or `feature/`): New features
    *   `fix/` (or `bugfix/`): Bug fixes
    *   `hotfix/`: Urgent production fixes
    *   `release/`: Release preparations
    *   `chore/`: Non-code updates (CI, dependencies, documentation)
*   **Example**: `feat/add-alert-sound` or `bugfix/fix-compass-drift`

#### Commit Messages
All commit messages must follow the Conventional Commits v1.0.0 specification:
*   **Format**: `<type>(<scope>)<!>: <description>`
*   **Example**: `feat(radar): add heading vectors` or `fix(gps): prevent null coordinates error`

---

## Local Development Workflow

### 1. Setup
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Run Local Dev Server
Start the development server with HMR:
```bash
npm run dev
```

### 3. Run Test Suite
We use [Vitest](https://vitest.dev/) for unit testing. Make sure all tests pass before submitting a PR:
```bash
npm run test
```

### 4. Build Production Bundle
Verify TypeScript compiling and build output:
```bash
npm run build
```
This also verifies service worker precache registration bundles are configured correctly under `dist/`.
