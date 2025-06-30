# Marketing System Wireframe Documentation

## Overview

This document outlines the new marketing system structure that replaces the previous simple email campaign system. The new system is designed around a hierarchical marketing strategy framework that supports multiple domains, focused expertise areas, content pillars, and strategic content creation.

## System Architecture

### 1. Marketing Domains (Top Level)
Marketing domains represent different channels or platforms where marketing activities take place.

**Examples:**
- Email Marketing 📧
- YouTube 📺
- LinkedIn 💼
- Twitter/X 🐦
- Instagram 📸
- Facebook 📘

**Structure:**
```javascript
{
  id: 'email',
  name: 'Email Marketing',
  icon: '📧',
  color: 'blue',
  focusCount: 2
}
```

### 2. Expertise/Focus Areas (Domain Level)
Each domain can have multiple focus areas that represent the overarching themes for all marketing material in that domain.

**Examples:**
- Business Efficiency
- Digital Transformation
- Process Optimization
- Technology Integration

**Structure:**
```javascript
{
  id: 'business-efficiency',
  name: 'Business Efficiency',
  description: 'Streamlining operations and maximizing productivity',
  pillars: [...],
  categories: {...},
  perspectives: [...],
  contentCount: 20
}
```

### 3. Content Pillars (Focus Level)
Content pillars are the core themes that support each focus area. They provide structure and consistency to content creation.

**Examples for Business Efficiency:**
- Automation: "Streamlining repetitive tasks"
- Integration: "Connecting systems seamlessly"
- Insight: "Data-driven decision making"

**Structure:**
```javascript
{
  id: 'automation',
  name: 'Automation',
  description: 'Streamlining repetitive tasks'
}
```

### 4. Content Categories (2x2 Matrix)
Based on customer mindset and motivation, content is categorized using a 2x2 matrix:

**Cognitive Space:** Emotional ↔ Rational
**Motivational Space:** Awareness ↔ Purchase

This creates four categories:

1. **Entertainment** (Emotional + Awareness)
   - Engaging, fun content that builds awareness
   - Stories, humor, relatable scenarios

2. **Inspire** (Emotional + Purchase)
   - Motivational content that drives action
   - Success stories, testimonials, aspirational content

3. **Educate** (Rational + Awareness)
   - Informational content that builds knowledge
   - How-to guides, tutorials, industry insights

4. **Convince** (Rational + Purchase)
   - Logical arguments for making a purchase
   - ROI calculations, feature comparisons, case studies

### 5. Perspective/Voice
Each focus area has a defined voice perspective:

- **Personal**: First-person, individual experiences
- **General Advice**: Broad, industry-wide guidance
- **Expert Advice**: Authoritative, specialized knowledge

### 6. Content Management
Content pieces are managed with the following statuses:

- **Published**: Live and active content
- **Scheduled**: Content planned for future release
- **In Development**: Content currently being created
- **Concept**: Ideas and concepts for future content

## Component Structure

### MarketingDomainSidebar.jsx
- Displays list of marketing domains
- Allows domain selection and creation
- Shows focus count for each domain

### MarketingDashboard.jsx
- Main content area for selected domain
- Shows focus areas overview
- Provides detailed views for pillars, categories, and content
- Handles focus selection and content management

### NewMarketingPanel.jsx
- Main orchestrator component
- Manages state between sidebar and dashboard
- Coordinates domain and focus selection

## Wireframe Features

### Domain Overview
- Grid layout showing all focus areas for a domain
- Quick stats (pillar count, content count)
- Add new focus area functionality

### Focus Details
- Tabbed interface for pillars, categories, and content
- Visual representation of the 2x2 category matrix
- Content management interface with status filtering

### Content Management
- Status-based filtering (Published, Scheduled, In Development, Concept)
- Content creation workflow
- Integration points for scheduling and publishing

## Integration Points

### Current System
The new system is designed to coexist with the existing email campaign system:
- Legacy email functionality remains available
- New strategic marketing system provides enhanced structure
- Gradual migration path from old to new system

### Future Enhancements
- Redux integration for state management
- API integration for data persistence
- Content scheduling and automation
- Analytics and performance tracking
- Template management system

## Usage Flow

1. **Select Domain**: User chooses a marketing domain from the sidebar
2. **View Overview**: Dashboard shows all focus areas for the selected domain
3. **Select Focus**: User clicks on a focus area to view details
4. **Manage Content**: User can view pillars, categories, and manage content
5. **Create Content**: User can create new content pieces with proper categorization

## Mock Data Structure

The wireframe includes comprehensive mock data demonstrating:
- Multiple domains with different focus areas
- Complete pillar definitions with descriptions
- All four content categories with content counts
- Realistic content management scenarios

This structure provides a solid foundation for implementing a comprehensive marketing strategy management system that scales from simple campaigns to complex, multi-domain marketing operations.