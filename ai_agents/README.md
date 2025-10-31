# AI Development Team

This folder contains AI agent personas that act as specialized team members for code review, quality assurance, and production readiness.

## 🎯 How to Use This Team

### Quick Start
1. Copy the agent prompt from the relevant `.md` file
2. Paste it into Cursor chat
3. Attach the file(s) you want reviewed
4. Ask the agent to perform their role

### Example Workflow

```bash
# 1. Get UI/UX review
# Copy uiux_agent.md prompt → Cursor → Attach component file → "Review this component"

# 2. Get architecture review  
# Copy architect_agent.md prompt → Cursor → Attach feature folder → "Review this feature"

# 3. Get QA coverage
# Copy qa_agent.md prompt → Cursor → Attach component → "Write tests for this"

# 4. Pre-deployment check
# Copy devops_agent.md prompt → Cursor → "Audit production readiness"
```

## 👥 Team Members

### 🎨 UI/UX Agent
**When to use:** Before shipping UI changes, during design iterations
**Files to attach:** Component files (`.js`), screen files
**Ask for:** Design consistency, accessibility, spacing/typography audits

**Quick prompt:**
```
Copy content from uiux_agent.md, then:
"Review [FILE] for design consistency, accessibility, and adherence to design tokens"
```

### 🏗️ Architect Agent  
**When to use:** When adding new features, before major refactors
**Files to attach:** Feature folders, component directories
**Ask for:** Code structure, performance, anti-patterns, scalability concerns

**Quick prompt:**
```
Copy content from architect_agent.md, then:
"Review [FOLDER/FILE] for architecture, performance, and best practices"
```

### 🧪 QA Agent
**When to use:** After feature completion, before PR merge
**Files to attach:** Components/screens to test
**Ask for:** Test plans, Jest tests, edge case coverage

**Quick prompt:**
```
Copy content from qa_agent.md, then:
"Write comprehensive tests for [FILE] covering happy paths and edge cases"
```

### 🚀 DevOps Agent
**When to use:** Before production deployment, during CI/CD setup
**Files to attach:** app.json, eas.json, package.json, env files
**Ask for:** Security audit, OTA setup, crash reporting, bundle optimization

**Quick prompt:**
```
Copy content from devops_agent.md, then:
"Audit production readiness: review configs, security, OTA updates, crash reporting"
```

## 📋 Production Checklist

Before shipping, run through `prompts/prod_checklist.txt`:
- ✅ Secure env keys (no secrets in repo)
- ✅ OTA updates configured  
- ✅ Crash/error reporting set
- ✅ Offline & retry strategies
- ✅ Accessibility audit passed
- ✅ e2e smoke tests green
- ✅ Bundle < ~30MB, TTFB < 2.5s
- ✅ No unhandled rejections
- ✅ Strict Typescript on critical paths

## 🔄 Recommended Workflow

### Daily Development
1. **Write code** → Implement feature
2. **Architect review** → Get structure/performance feedback
3. **UI/UX review** → Ensure design consistency
4. **QA tests** → Get test coverage
5. **Iterate** → Fix issues found

### Pre-Deployment
1. **DevOps audit** → Production readiness check
2. **Full checklist** → Run through prod_checklist.txt
3. **Final review** → All agents sign off

## 💡 Tips

- **Start with one agent**: Don't overwhelm yourself. Pick the most relevant agent for your current task.
- **Be specific**: Tell agents exactly what to focus on (e.g., "Review for performance issues")
- **Iterate**: Use agent feedback to improve, then re-review
- **Combine agents**: After UI/UX review, get QA tests. After architecture review, get DevOps audit.

## 🎯 Common Scenarios

### Scenario 1: New Feature
```
1. Architect Agent → Review structure
2. UI/UX Agent → Design consistency  
3. QA Agent → Test coverage
4. DevOps Agent → No config changes needed (if just feature)
```

### Scenario 2: UI Polish
```
1. UI/UX Agent → Design audit
2. QA Agent → Visual regression tests
```

### Scenario 3: Performance Issue
```
1. Architect Agent → Performance audit
2. DevOps Agent → Bundle size check
```

### Scenario 4: Production Release
```
1. DevOps Agent → Full production audit
2. All agents → Final review pass
3. Checklist → Verify all items
```

## 📁 File Structure

```
ai_agents/
├── README.md              # This file
├── architect_agent.md     # Architecture & performance reviews
├── devops_agent.md        # Production readiness & security
├── qa_agent.md           # Test writing & coverage
├── uiux_agent.md         # Design & accessibility audits
└── prompts/
    └── prod_checklist.txt # Production checklist
```

## 🚀 Getting Started

1. Pick a component or feature to review
2. Choose the relevant agent
3. Copy their prompt into Cursor
4. Attach the file(s)
5. Ask for review
6. Implement feedback
7. Repeat with next agent if needed

---

**Remember:** These agents are tools to augment your workflow. Use them consistently for best results, but trust your judgment as the product owner.


