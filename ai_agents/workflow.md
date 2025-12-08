# Agent Workflow Guide

Step-by-step workflows for using your AI development team.

## 📝 Standard Feature Development Workflow

### Phase 0: Planning & Task Breakdown
```
1. Break feature into small, isolated tasks
   → Instead of "Build auth", break into:
     - Define the user model
     - Create the registration route
     - Add password hashing
     - Add login logic
     - Add token generation
   
2. Write short pseudocode for each task
   → Gives AI clear boundaries
   → Prevents unnecessary complexity

3. Reference core documents
   → REQUIREMENTS.md for feature requirements
   → USER_STORIES.md for acceptance criteria
   → CONVENTIONS.md for coding standards
   → ARCHITECTURE.md for system design
```

### Phase 1: Explain Before Code
```
1. Present the task to AI
   → "I need to implement [specific task]"
   → Attach relevant files and context

2. Ask AI to explain approach
   → "Before writing code, explain how you plan to implement this"
   → "What files will you modify?"
   → "What are the key steps?"

3. Review and correct the explanation
   → Much easier than correcting 200 lines of wrong code
   → Ensure AI understands the requirements
   → Clarify any misunderstandings

4. Request diff-style changes
   → "Show me the changes as a diff"
   → "Only modify the files I explicitly mention"
   → Keeps project stable and reduces accidental rewrites
```

### Phase 2: Implementation
```
1. Implement one small task at a time
   → AI works best on precise, focused tasks
   → Small tasks reduce hallucinations
   → Simplify debugging

2. Re-paste files periodically
   → Every few edits, paste the full updated file back
   → Keeps AI aware of the real current version
   → Prevents drift from actual codebase state

3. Set explicit scope rules
   → "Only modify the files I explicitly mention"
   → Prevents AI from editing unrelated parts
   → Reduces hidden bugs

4. Commit small, frequent changes
   → Use git for every step
   → If AI breaks something, diffs make it clear
   → Ask AI to ensure fixes are idempotent
```

### Phase 3: Code Quality (Parallel)
```
Option A: Architecture First
  → Use architect_agent.md
  → Get structure/performance feedback
  → Fix issues
  → Move to UI/UX

Option B: UI/UX First  
  → Use uiux_agent.md
  → Get design consistency feedback
  → Fix issues
  → Move to Architecture
```

### Phase 4: Testing
```
→ Use qa_agent.md
→ Get test coverage
→ Implement tests
→ Run tests to verify
```

### Phase 5: Pre-Merge
```
→ Quick DevOps check (if config changes)
→ Verify no console warnings
→ Check bundle size if new deps added
```

## 🎨 UI/UX Focused Workflow

**When:** Redesigning screens, adding new UI components

```
1. Design Review
   → Copy uiux_agent.md prompt
   → Attach component file
   → Request: "Review for design consistency and accessibility"

2. Accessibility Audit
   → Same agent
   → Request: "Check color contrast, labels, and screen reader support"

3. Design Token Compliance
   → Same agent  
   → Request: "Ensure all styles use designTokens.js, no inline styles"

4. Visual Polish
   → Review feedback
   → Implement changes
   → Re-review if needed
```

## 🏗️ Architecture Focused Workflow

**When:** Adding complex features, performance concerns, refactoring

```
1. Structure Review
   → Copy architect_agent.md prompt
   → Attach feature folder or files
   → Request: "Review for structure and scalability"

2. Performance Audit
   → Same agent
   → Request: "Identify performance bottlenecks and optimization opportunities"

3. Anti-Pattern Check
   → Same agent
   → Request: "Find anti-patterns, duplications, heavy UI logic"

4. Refactoring Plan
   → Review recommendations
   → Prioritize fixes
   → Implement incrementally
   → Re-review after changes
```

## 🧪 QA Focused Workflow

**When:** Feature complete, before PR, preparing for release

```
1. Test Plan
   → Copy qa_agent.md prompt
   → Attach component/file
   → Request: "Create test plan covering happy paths and edge cases"

2. Test Implementation
   → Review test plan
   → Request: "Write Jest tests based on this plan"

3. Edge Case Coverage
   → Request: "Add tests for error states, offline mode, async flows"

4. Test Review
   → Run tests
   → Fix any failures
   → Verify coverage
```

## 🚀 Pre-Production Workflow

**When:** Before major release, setting up CI/CD, production deployment

```
1. Configuration Audit
   → Copy devops_agent.md prompt
   → Attach: app.json, eas.json, package.json
   → Request: "Audit all configuration files"

2. Security Check
   → Same agent
   → Request: "Check for security risks, exposed secrets, env handling"

3. OTA & Monitoring Setup
   → Request: "Verify OTA updates configured, crash reporting set up"

4. Bundle Optimization
   → Request: "Check bundle size, startup time, suggest optimizations"

5. Production Checklist
   → Go through prompts/prod_checklist.txt
   → Verify each item
   → Get agent help on any gaps
```

## 🔄 Iterative Review Workflow

**For complex features or when multiple issues are found:**

```
1. Initial Review
   → Get agent feedback
   → Prioritize issues (High/Medium/Low)

2. Fix High Priority
   → Implement critical fixes
   → Re-review with agent
   → "Have I addressed the high priority issues?"

3. Fix Medium Priority
   → Implement important fixes
   → Re-review
   → "Are there remaining issues?"

4. Document Low Priority
   → Create tech debt ticket
   → Ship feature
   → Address in next iteration
```

## 🎯 Quick Reviews (5 minutes)

**When you need fast feedback on a specific concern:**

```
Performance Check:
"Review [FILE] for performance issues - check for unnecessary re-renders, heavy computations"

Accessibility Check:
"Review [FILE] for accessibility - check labels, contrast, screen reader support"

Design Consistency:
"Review [FILE] - ensure it uses designTokens.js and matches app design system"

Test Coverage:
"Review [FILE] - what edge cases should I test? What's missing?"
```

## 📊 Review Frequency Guide

| Change Type | Recommended Agents | Frequency |
|------------|-------------------|-----------|
| New Component | UI/UX → QA | Every time |
| Feature Addition | Architect → UI/UX → QA | Every time |
| Bug Fix | QA | Every time |
| Performance Issue | Architect → DevOps | When needed |
| UI Polish | UI/UX | Every time |
| Config Change | DevOps | Every time |
| Major Refactor | Architect → QA | Every time |
| Pre-Release | All agents | Before major releases |

## 🔧 AI Best Practices (From Reddit Post)

### 1. Explain Before Code
**Why**: Correcting an explanation is much easier than correcting 200 lines of wrong code.

**How**:
- Before asking for code, have the model restate the task
- Ask it to explain how it plans to implement it
- Correct the explanation if needed
- Then proceed with implementation

**Example**:
```
You: "I need to add password hashing to the registration route"
AI: [Explains approach]
You: "Actually, use bcryptjs instead of bcrypt, and hash before saving"
AI: [Updates explanation]
You: "Good, now implement it"
```

### 2. Small, Isolated Tasks
**Why**: AI fails on broad prompts but succeeds on precise ones.

**How**:
- Break "Build auth" into: define user model → registration route → hashing → login logic
- Each task should be independently testable
- Small tasks reduce hallucinations and simplify debugging

**Example**:
- ❌ "Build authentication system"
- ✅ "Create User model with email and hashed password fields"
- ✅ "Add POST /api/auth/register endpoint that validates email and hashes password"

### 3. File Re-Paste Workflow
**Why**: Keeps AI aware of the real current version of files.

**How**:
- Every few edits, paste the full updated file back
- This resets context and keeps the model aligned
- Prevents AI from working with outdated assumptions

**When**:
- After 3-5 edits to the same file
- When switching between multiple files
- When AI seems confused about current state

### 4. Modular Architecture Validation
**Why**: If AI requires your entire codebase to make small changes, structure is too tightly coupled.

**How**:
- Design modules so each part can be understood independently
- Consistent naming helps AI follow patterns
- Test: Can you explain a module without showing the whole codebase?

**Checklist**:
- ✅ Can modify one module without touching others?
- ✅ Clear boundaries between components?
- ✅ Consistent naming patterns?
- ✅ Each module has single responsibility?

### 5. Use Multiple Models Strategically
**Why**: Different LLMs have different strengths.

**How**:
- Use one for planning (explain approach)
- Use another for code generation
- Use a third for cross-checking logic
- If an answer seems odd, ask another model

### 6. Maintain Documentation as You Go
**Why**: Keeps model aligned with project's actual state.

**How**:
- Keep REQUIREMENTS.md, ARCHITECTURE.md, CONVENTIONS.md updated
- After long chats, start a new thread and reintroduce core documents
- This resets context and keeps the model aligned

## 💡 Pro Tips

1. **Batch Reviews**: If you made multiple related changes, review them together
2. **Be Specific**: Tell agents what to focus on ("Review for performance only")
3. **Use Context**: Attach related files so agents understand dependencies
4. **Iterate Quickly**: Don't wait for perfection - get feedback, fix, ship
5. **Document Findings**: Keep notes on patterns agents find - helps avoid repeat issues
6. **Explain First**: Always have AI explain approach before coding
7. **Small Tasks**: Break features into tiny, testable pieces
8. **Re-paste Files**: Keep AI aware of current file state

## 🚫 What NOT to Do

- ❌ Don't review every single line of code - focus on critical paths
- ❌ Don't implement every suggestion - prioritize based on impact
- ❌ Don't skip reviews for "small" changes - small issues compound
- ❌ Don't review in isolation - agents need context (attach related files)

## ✅ Success Metrics

Your agent team is working well when:
- ✅ Code reviews catch issues before PR
- ✅ Tests prevent regressions
- ✅ UI is consistent across app
- ✅ No production incidents from code quality
- ✅ Bundle size stays reasonable
- ✅ Accessibility score improves

---

**Remember**: These agents are tools. Use them to augment your judgment, not replace it. You're the product owner - use feedback wisely!


