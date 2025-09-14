# Architecture Design Scratchpad - DevTeam Feature

## Context Review Complete
✅ DevTeam Charter reviewed - comprehensive automation workflow engine
✅ Project Charter reviewed - internal productivity extension for Clarity CRM
✅ PRD reviewed - detailed requirements and specifications
✅ Design Blueprint reviewed - existing React architecture patterns

## Key Requirements Identified
- **Core Vision**: Transform CRM from passive tracker to active execution engine
- **Target Metrics**: ≥50% task automation rate, ≥30% cycle time reduction
- **Architecture**: Three-tier system (React UI, Python Orchestrator, Docker Local Runner)
- **State Machine**: SELECT → PREP → IMPLEMENT → VERIFY → MERGE → PUSH → DONE
- **Security**: Local-only execution, command allowlists, Docker isolation
- **Integration**: GitHub, AI tools (Aider, Claude Code, Ollama), existing CRM

## Architecture Components Designed ✅
- [x] **Simplified Frontend Integration** - Extend existing TaskList.jsx, no new components
- [x] **Minimal Backend Extension** - Extend existing task API, no new services
- [x] **Simple Automation Service** - Basic 4-step workflow with Aider only
- [x] **Minimal Data Models** - Extend existing task/project models
- [x] **Basic Security Approach** - Use existing CRM authentication patterns
- [x] **Integration Patterns** - Leverage existing Redux and component patterns

## Key Simplifications Applied
- **75% Complexity Reduction**: From enterprise-scale to small-team appropriate
- **Single AI Tool**: Aider only, no multi-tool orchestration
- **No New Infrastructure**: Uses existing CRM database and API
- **Extend, Don't Replace**: Add automation button to existing TaskList component
- **3-Week Timeline**: Focused implementation roadmap

## Architecture Design Complete ✅
✅ **Document Created**: `docs/DevTeam/core_docs/architecture_design.md`
✅ **Aligned with Simplified PRD**: Follows 30% automation target, not 50%
✅ **Small Team Focus**: Appropriate for 2-5 developer teams
✅ **Minimal Infrastructure**: Zero additional services or deployment complexity
✅ **Practical Implementation**: 3-phase roadmap with immediate value delivery

## Key Design Decisions
- **Component Extension**: Modify existing TaskList.jsx instead of creating new components
- **State Management**: Extend existing Redux patterns, no new slices
- **API Integration**: Add endpoints to existing task API
- **Dockerized Local Runner**: Aider runs in Docker container for consistency
- **Basic Validation**: npm test + npm run lint only

## Docker Integration Update ✅
✅ **User Feedback Incorporated**: Requested dockerized local runner
✅ **Simple Docker Setup**: Basic Dockerfile + docker-compose.yml
✅ **Container Benefits**: Environment consistency, isolation, easy setup
✅ **Minimal Complexity**: Python 3.11 + aider-chat package only
✅ **Node.js Integration**: exec() calls to docker-compose run commands
✅ **Architecture Updated**: All references changed from local to containerized execution