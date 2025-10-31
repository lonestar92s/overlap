# 🎯 Real Example: How to Use Your AI Agents

Let's walk through a **real example** step-by-step.

## Example: Reviewing MatchCard Component

### Step 1: Find the File
You want to review `components/MatchCard.js` for design consistency.

### Step 2: Get the Agent Prompt
1. Open `ai_agents/uiux_agent.md` in Cursor
2. **Select all the text** (Cmd+A or Ctrl+A)
3. **Copy it** (Cmd+C or Ctrl+C)

The content you copied looks like:
```
You are a Design Engineer for React Native/Expo.
Audit for spacing (8pt grid), typography, color contrast...
[rest of the prompt]
```

### Step 3: Open Cursor Chat
- Click the chat icon in Cursor (or press Cmd+L / Ctrl+L)
- You'll see a chat panel open

### Step 4: Paste the Agent Prompt
1. In the chat, **paste** what you copied (Cmd+V)
2. You'll see the agent instructions appear in chat

### Step 5: Attach Your File
1. In the chat input area, look for an **attachment icon** or **paperclip icon**
2. Click it and select: `mobile-app/components/MatchCard.js`
3. Or type `@MatchCard.js` and select the file
4. You'll see the file attached to your message

### Step 6: Ask for Review
Type this message:
```
Review this component for design consistency and accessibility.
```

### Step 7: See the Results
The agent will analyze your file and give you:
- ✅ Issues found (e.g., "Using inline styles instead of designTokens")
- ✅ Updated code suggestions
- ✅ Accessibility notes
- ✅ Design feedback

### Step 8: Implement Changes
1. Review the agent's suggestions
2. Apply the changes it recommends
3. You can ask follow-up questions like:
   - "Have I fixed all the issues?"
   - "What else needs attention?"

---

## Visual Guide (What You'll See)

```
┌─────────────────────────────────────────┐
│  Cursor Chat                            │
├─────────────────────────────────────────┤
│                                         │
│  [You paste uiux_agent.md content]      │
│  [You attach MatchCard.js]              │
│  [You type: "Review this component"]    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  🤖 AI Agent:                           │
│                                         │
│  Found 3 issues:                        │
│  1. Line 45: Using inline padding       │
│     Should use: spacing.md              │
│  2. Line 67: Missing accessibilityLabel  │
│  3. Line 89: Font size hardcoded        │
│     Should use: typography.body         │
│                                         │
│  Here's the fixed code...              │
│                                         │
└─────────────────────────────────────────┘
```

---

## Common Questions

### Q: Do I paste the agent file EVERY time?
**A:** Yes, but after the first time, Cursor remembers the context. You can just say "Review this too" for similar files.

### Q: What if I don't see an attachment button?
**A:** You can also:
- Type `@` and start typing the filename, then select it
- Drag and drop the file into the chat
- Reference it by path: "Review `mobile-app/components/MatchCard.js`"

### Q: Can I review multiple files at once?
**A:** Yes! Attach multiple files or use `@filename` multiple times.

### Q: What's the difference between agents?
**A:**
- **UI/UX Agent** = "Does this look right? Is it accessible?"
- **Architect Agent** = "Is this code well-structured? Will it scale?"
- **QA Agent** = "What tests should I write?"
- **DevOps Agent** = "Is this production-ready?"

---

## Try It Now! 🚀

Let's do a real example with your codebase:

1. Open `ai_agents/uiux_agent.md`
2. Copy all the text
3. Open Cursor chat (Cmd+L)
4. Paste the agent prompt
5. Attach: `mobile-app/components/MatchCard.js` (or any component)
6. Type: "Review this component"
7. Press Enter

You should see the agent review your component!

---

## What to Expect

The agent will tell you things like:
- ✅ "Good: Using designTokens for colors"
- ⚠️ "Issue: Line 23 uses inline style, should use spacing.md"
- ✅ "Accessibility: All buttons have labels"
- ⚠️ "Warning: Color contrast ratio is 3.2:1, needs to be 4.5:1"

Then it gives you **fixed code** you can copy-paste or apply.

---

## Pro Tips

1. **Start small**: Review one component first to understand the process
2. **Ask follow-ups**: "Have I fixed the issues?" or "What else?"
3. **Batch reviews**: Once you understand it, review multiple related files together
4. **Save responses**: Keep notes on patterns the agent finds

---

## Still Confused?

Try this **super simple version**:

1. Copy this exact text:
   ```
   You are a Design Engineer for React Native/Expo. Review the attached component for design consistency, accessibility, and adherence to designTokens.js. Provide specific issues and fixes.
   ```

2. Paste in Cursor chat

3. Attach any `.js` component file

4. Press Enter

That's it! You'll get a review.

