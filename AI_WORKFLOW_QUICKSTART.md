# AI Workflow Quick Reference

One-page reference for Reddit post best practices when working with AI coding assistants.

## Core Principle

> **AI doesn't replace process. It exposes the lack of one.**

AI is a multiplier - it makes good processes more effective and bad ones more painful.

## The 10 Practices

### 1. Plan Before You Write Code
- ✅ Create REQUIREMENTS.md with explicit features
- ✅ Write USER_STORIES.md describing real user actions
- ✅ Document stack and pin versions in CONVENTIONS.md
- ✅ Define folder structure and naming in CONVENTIONS.md
- ✅ Break features into small tasks with pseudocode

**Why**: AI works best when the project is well-defined. Clear boundaries prevent AI from inventing unnecessary complexity.

### 2. Start With a Framework and Fixed Versions
- ✅ Use scaffolding frameworks (Next.js, SvelteKit, Expo)
- ✅ Always specify exact package versions (no `^` or `~`)
- ✅ Version mismatch is hell - pin everything

**Why**: Framework defaults prevent mixing patterns. Exact versions prevent "works on my machine" issues.

### 3. Make AI Explain Before It Codes
- ✅ Before asking for code, have AI restate the task
- ✅ Ask AI to explain how it plans to implement it
- ✅ Correct the explanation (much easier than fixing 200 lines of wrong code)
- ✅ Request diff-style changes when asking for updates

**Why**: Correcting an explanation is 10x faster than correcting wrong code.

### 4. Give the Model Small, Isolated Tasks
- ❌ "Build auth"
- ✅ "Define the user model"
- ✅ "Create the registration route"
- ✅ "Add password hashing"
- ✅ "Add login logic"

**Why**: AI fails on broad prompts but succeeds on precise ones. Small tasks reduce hallucinations and simplify debugging.

### 5. Use Multiple Models Strategically
- Use one for planning
- Use another for code generation
- Use a third for cross-checking logic
- If an answer seems odd, ask another model

**Why**: Different LLMs have different strengths. Cross-checking catches mistakes.

### 6. Maintain Documentation as You Go
- ✅ Keep REQUIREMENTS.md, ARCHITECTURE.md, CONVENTIONS.md updated
- ✅ After long chats, start a new thread
- ✅ Reintroduce core documents to reset context

**Why**: Keeps AI aligned with project's actual state, not outdated assumptions.

### 7. Re-Paste Files and Limit Scope
- ✅ Every few edits, paste the full updated file back
- ✅ Set rule: "Only modify the files I explicitly mention"
- ✅ Prevents AI from editing unrelated parts (common source of hidden bugs)

**Why**: Keeps AI aware of real current version. Prevents accidental rewrites.

### 8. Review and Test Like a Developer
- ✅ Look for inconsistent imports
- ✅ Check nested logic
- ✅ Verify changes didn't affect other features
- ✅ Run adjacent tests, not just the feature you touched

**Why**: AI sometimes adjusts things silently. Testing nearby functionality is essential.

### 9. Use Git for Every Step
- ✅ Commit small, frequent changes
- ✅ If AI breaks something, diffs make it clear what happened
- ✅ Ask AI to ensure fixes are idempotent (running same patch twice shouldn't cause problems)

**Why**: Version control is your safety net. Small commits make debugging easier.

### 10. Keep the Architecture Modular
- ✅ If AI requires your entire codebase to make small changes, structure is too tightly coupled
- ✅ Design modules so each part can be understood independently
- ✅ Consistent naming helps AI follow your patterns instead of creating new ones

**Why**: Modular architecture makes AI more effective and code more maintainable.

## Quick Workflow

```
1. Plan → Break feature into small tasks
2. Explain → Have AI explain approach before coding
3. Implement → One small task at a time
4. Re-paste → Every few edits, paste full file back
5. Test → Run tests, check adjacent functionality
6. Commit → Small, frequent git commits
7. Review → Use AI agents for code quality checks
```

## Essential Documents

- **REQUIREMENTS.md** - Feature requirements
- **USER_STORIES.md** - User stories and acceptance criteria
- **CONVENTIONS.md** - Coding standards, folder structure, naming
- **ARCHITECTURE.md** - System architecture overview
- **AI_WORKFLOW_QUICKSTART.md** - This file

## Common Mistakes to Avoid

- ❌ Asking AI to "build auth" (too broad)
- ❌ Not having AI explain approach first
- ❌ Not re-pasting files after multiple edits
- ❌ Using `^` or `~` in package.json
- ❌ Not breaking features into small tasks
- ❌ Not testing adjacent functionality
- ❌ Not committing frequently
- ❌ Tightly coupled architecture

## Remember

**AI is a multiplier. A stable process is what actually ships products.**

For detailed workflows, see `ai_agents/workflow.md`.

