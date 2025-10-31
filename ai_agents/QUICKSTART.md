# 🚀 Quick Start Guide

Get started with your AI development team in 3 minutes.

## ⚡ Fastest Way to Use Agents

### Method 1: Copy-Paste (Recommended)

1. **Open the agent file** you need:
   - `uiux_agent.md` for design reviews
   - `architect_agent.md` for code structure
   - `qa_agent.md` for tests
   - `devops_agent.md` for production checks

2. **Copy the entire content**

3. **Paste into Cursor chat**

4. **Attach your file(s)** and ask for review

**Example:**
```
[Paste uiux_agent.md content]

[Attach: components/MatchCard.js]

Review this component for design consistency and accessibility.
```

### Method 2: Quick Prompts

Use `prompts/quick_review.md` for ready-to-use prompts.

## 🎯 Common Tasks

### "I just built a new component"
```
1. Copy uiux_agent.md → Cursor
2. Attach your component file
3. "Review for design consistency"
4. Fix issues
5. Copy qa_agent.md → Cursor  
6. "Write tests for this component"
```

### "I'm about to ship to production"
```
1. Copy devops_agent.md → Cursor
2. Attach: app.json, eas.json, package.json
3. "Audit production readiness"
4. Check prompts/prod_checklist.txt
5. Fix any gaps
```

### "Is my code scalable?"
```
1. Copy architect_agent.md → Cursor
2. Attach feature folder
3. "Review for architecture and performance"
4. Implement recommendations
```

### "Does my UI look consistent?"
```
1. Copy uiux_agent.md → Cursor
2. Attach screen/component files
3. "Review for design token compliance and consistency"
```

## 📋 Before Every PR

Run this quick checklist:
- [ ] UI/UX agent reviewed UI changes
- [ ] Architect agent reviewed if major feature
- [ ] QA agent wrote tests for new code
- [ ] No console warnings
- [ ] Tests pass

## 🎨 Design Reviews (Most Common)

**For any UI component:**
```
1. Open uiux_agent.md
2. Copy all content
3. Paste in Cursor
4. Attach: [your component file]
5. Type: "Review this component"
```

Agent will check:
- ✅ Uses designTokens.js (not inline styles)
- ✅ Spacing follows 8pt grid
- ✅ Typography matches system
- ✅ Color contrast (accessibility)
- ✅ Accessibility labels
- ✅ Consistent with app design

## 🏗️ Architecture Reviews

**For features or major changes:**
```
1. Open architect_agent.md  
2. Copy all content
3. Paste in Cursor
4. Attach: [feature folder or files]
5. Type: "Review for architecture and performance"
```

Agent will check:
- ✅ Code structure
- ✅ Performance issues
- ✅ Anti-patterns
- ✅ Scalability concerns
- ✅ Duplications

## 🧪 Test Coverage

**After completing a feature:**
```
1. Open qa_agent.md
2. Copy all content
3. Paste in Cursor
4. Attach: [component file]
5. Type: "Write comprehensive tests"
```

Agent will provide:
- ✅ Test plan
- ✅ Jest test code
- ✅ Edge case coverage
- ✅ Error state tests

## 🚀 Production Checks

**Before major releases:**
```
1. Open devops_agent.md
2. Copy all content
3. Paste in Cursor
4. Attach: app.json, eas.json, package.json
5. Type: "Audit production readiness"
```

Agent will check:
- ✅ Config files correct
- ✅ Security (no exposed secrets)
- ✅ OTA updates configured
- ✅ Crash reporting set up
- ✅ Bundle size reasonable

## 💡 Pro Tip

**Save time:** Once you use an agent, Cursor remembers the context. You can say:
- "Review this too" (for similar files)
- "Have I fixed the issues?"
- "What else needs attention?"

## 🆘 Need Help?

- **Too many issues?** Prioritize High → Medium → Low
- **Conflicting advice?** You're the product owner - use judgment
- **Not sure which agent?** Start with UI/UX or Architect based on your change

## ✅ Success!

You're successfully using your AI team when:
- Code quality improves over time
- Fewer bugs in production  
- UI stays consistent
- Tests catch issues early
- You feel more confident shipping

---

**Remember:** These agents help you ship with confidence. Use them consistently for best results!

