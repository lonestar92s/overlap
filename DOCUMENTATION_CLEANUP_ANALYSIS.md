# Documentation Cleanup Analysis

This document identifies markdown files that may be duplicates, obsolete, or candidates for consolidation.

## Core Documents (Keep - Newly Created)

These are the new core process documents and should be kept:
- ✅ `REQUIREMENTS.md` - Centralized feature requirements
- ✅ `USER_STORIES.md` - User stories
- ✅ `CONVENTIONS.md` - Coding conventions
- ✅ `ARCHITECTURE.md` - Architecture overview
- ✅ `AI_WORKFLOW_QUICKSTART.md` - Quick reference guide

## Potential Duplicates/Consolidation Candidates

### Quick Start Guides (Consider Consolidating)
- `ai_agents/QUICKSTART.md` - May overlap with AI_WORKFLOW_QUICKSTART.md
- `ai_agents/SIMPLE_START.md` - May overlap with QUICKSTART.md
- `ai_agents/EXAMPLE_WALKTHROUGH.md` - Example walkthrough, may be outdated

**Recommendation**: Review these and consolidate into one comprehensive quickstart, or keep only the most current one.

### Testing Documentation (May Have Overlap)
- `ai_agents/TESTING_GUIDE.md` - Testing guide
- `ai_agents/TESTING_QUICK_START.md` - Quick testing guide
- `README_TESTING.md` - Testing README
- `TEST_PLAN.md` - Comprehensive test plan

**Recommendation**: Consolidate into `TEST_PLAN.md` as the main testing document, with links to quick references if needed.

### Architecture Documentation (May Have Overlap)
- `ai_agents/ARCHITECTURE_ANALYSIS.md` - Detailed architecture analysis
- `ai_agents/ARCHITECTURE_REVIEW.md` - Architecture review
- `ARCHITECTURE.md` - New architecture overview (links to detailed docs)

**Recommendation**: Keep `ARCHITECTURE.md` as overview, keep detailed analysis docs but ensure they're linked from ARCHITECTURE.md.

### Map Analysis (Likely Duplicate)
- `mobile-app/MAP_SEARCH_ANALYSIS.md` - Original analysis
- `mobile-app/MAP_SEARCH_ANALYSIS_UPDATED.md` - Updated analysis

**Recommendation**: Keep only `MAP_SEARCH_ANALYSIS_UPDATED.md`, remove or archive the original.

### Historical Fix Documents (Likely Obsolete)
These document specific fixes that are likely already implemented:
- `mobile-app/BUILD_FIX.md` - Build fix documentation
- `mobile-app/TESTFLIGHT_CRASH_FIX.md` - Crash fix documentation
- `mobile-app/UPDATE_FINGERPRINT_ISSUE.md` - Fingerprint issue fix
- `mobile-app/KEYBOARD_FIXES_IMPLEMENTED.md` - Keyboard fixes
- `mobile-app/KEYBOARD_BEHAVIOR_AUDIT.md` - Keyboard audit (may be superseded by FIXES_IMPLEMENTED)

**Recommendation**: Archive these to a `docs/archive/` folder or remove if fixes are confirmed implemented and no longer relevant.

### Component Audit Reports (May Be Outdated)
- `mobile-app/components/AUDIT_REPORT.md` - Component audit
- `mobile-app/components/COMPONENT_AUDIT_REPORT.md` - Component audit report
- `mobile-app/components/CRITICAL_FIXES_SUMMARY.md` - Critical fixes
- `mobile-app/components/HIGH_PRIORITY_FIXES_SUMMARY.md` - High priority fixes

**Recommendation**: Review these - if fixes are implemented, archive. If still relevant, consolidate into one document.

### Performance Tracking (May Be Duplicate)
- `mobile-app/utils/PERFORMANCE_PHASE_TRACKING.md` - Phase tracking
- `mobile-app/utils/PERFORMANCE_TRACKING.md` - Performance tracking

**Recommendation**: Consolidate into one performance tracking document.

### Setup/Configuration (Review for Consolidation)
- `ENVIRONMENT_SETUP.md` - Environment setup
- `RAILWAY_ENV_SETUP.md` - Railway environment setup
- `mobile-app/ENV_SETUP.md` - Mobile app env setup
- `mobile-app/MAPBOX_SETUP.md` - Mapbox setup

**Recommendation**: Consider consolidating into `ENVIRONMENT_SETUP.md` with sections for different environments.

### Migration/Update Guides (May Be Obsolete)
- `mobile-app/MIGRATION_SUMMARY.md` - Migration summary
- `mobile-app/QUICK_UPDATE_GUIDE.md` - Quick update guide

**Recommendation**: Review - if migration is complete, archive. If still relevant, keep.

## Files to Definitely Keep

### Core Documentation
- All files in `ai_agents/` that are agent prompts (architect_agent.md, qa_agent.md, etc.)
- `ai_agents/workflow.md` - Enhanced workflow guide
- `ai_agents/README.md` - AI agents README
- `TEST_PLAN.md` - Comprehensive test plan
- `SECURITY_AUDIT_2025.md` - Security audit
- `CI_CD_SETUP.md` - CI/CD setup
- `GIT_HOOKS_SETUP.md` - Git hooks setup

### Feature Documentation
- `ai_agents/FLIGHT_TRAIN_SEARCH_ARCHITECTURE.md` - Feature architecture
- `ai_agents/MULTI_MATCH_SEARCH_ARCHITECTURE.md` - Feature architecture
- `ai_agents/NOTIFICATIONS_SERVICE_ARCHITECTURE.md` - Feature architecture
- `ai_agents/PHASE1_TECHNICAL_SPECS.md` - Technical specs
- `ai_agents/WIREFRAMES.md` - Wireframes
- All API contracts and implementation guides

### Backend Documentation
- `overlap/backend/docs/*.md` - Backend documentation
- `overlap/README.md` - Overlap README

## Recommended Cleanup Actions

1. **Archive Historical Fixes**: Move fix documents to `docs/archive/` folder
2. **Consolidate Quick Starts**: Keep one comprehensive quickstart
3. **Consolidate Testing Docs**: Keep `TEST_PLAN.md` as main, link to quick references
4. **Remove Duplicate Map Analysis**: Keep only updated version
5. **Consolidate Performance Tracking**: Merge into one document
6. **Review Component Audits**: Archive if fixes implemented, consolidate if still relevant

## Next Steps

1. Review each candidate file
2. Confirm if fixes/issues are resolved
3. Archive or remove obsolete files
4. Consolidate duplicates
5. Update references in other documents

## Notes

- Be careful not to delete files that contain unique information
- When in doubt, archive rather than delete
- Update any cross-references after cleanup
- Consider creating a `docs/archive/` folder for historical documents

