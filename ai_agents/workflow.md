# Agent Workflow Guide

Step-by-step workflows for using your AI development team.

## 📝 Standard Feature Development Workflow

### Phase 1: Implementation
```
1. Write your feature code
2. Commit your changes
```

### Phase 2: Code Quality (Parallel)
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

### Phase 3: Testing
```
→ Use qa_agent.md
→ Get test coverage
→ Implement tests
→ Run tests to verify
```

### Phase 4: Pre-Merge
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

## 💡 Pro Tips

1. **Batch Reviews**: If you made multiple related changes, review them together
2. **Be Specific**: Tell agents what to focus on ("Review for performance only")
3. **Use Context**: Attach related files so agents understand dependencies
4. **Iterate Quickly**: Don't wait for perfection - get feedback, fix, ship
5. **Document Findings**: Keep notes on patterns agents find - helps avoid repeat issues

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


