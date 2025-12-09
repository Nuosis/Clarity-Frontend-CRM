# Supabase Database Verification Pattern

## Critical Instructions
1. **Server Environment**: This project runs on a remote server, NOT locally
2. **No Local Docker**: Do NOT use `docker ps` directly - you MUST SSH first
3. **SSH Connection**: Use `ssh marcus@backend.claritybusinesssolutions.ca "command"`

## Verified Pattern for Listing All Tables

```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\""
```

## Container Details
- **Container Name**: `supabase-db`
- **Container ID**: 1f7270bec14b (may change on restart)
- **PostgreSQL User**: `postgres`
- **Database**: `postgres`

## Available Tables (as of 2025-12-05)
- agent_memory
- alembic_version
- blog_posts
- blog_section_images
- blog_sections
- contact_sync_batches
- contact_vcard_data
- contacts
- crossfit_equipment
- crossfit_user_equipment
- crossfit_users
- crossfit_wod_exercises
- crossfit_wods
- customer_address
- customer_contacts
- customer_email
- customer_organization
- customer_phone
- customer_sales
- customer_settings
- customer_user
- customers
- email_blacklist
- email_graylist
- email_whitelist
- events
- functions
- integration_tokens
- license_modules
- licenses
- llm_api_keys
- organization_license
- organizations
- products
- projects
- **proposal_deliverables** ✓
- **proposal_packages** ✓
- **proposal_packages_deliverables** ✓
- **proposal_packages_requirements** ✓
- **proposal_requests** ✓
- **proposal_requirements** ✓
- **proposals** ✓
- sms
- sms_messages
- sms_participants
- support_request_assignments
- support_request_attachments
- support_request_comments
- support_request_metrics
- support_request_notifications
- support_request_status_history
- support_request_tags
- support_requests
- system_agent_tools_junction
- system_agents
- system_tools
- task_dependencies
- task_execution_steps
- task_executions
- task_rollback_actions
- task_state_transitions
- task_templates
- tasks_paused
- tasks_scheduled
- to_review
- twilio_conversation_events
- user_preferences
- user_profile
- vapi_call_history

## Other Useful Queries

### Check if a specific table exists:
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'table_name');\""
```

### Describe table structure:
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ table_name\""
```

### List all containers:
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker ps"
```

## SSH Rules (from rules_general.md)
- SSH connections CANNOT maintain persistent sessions
- MUST use individual SSH commands for each operation
- NEVER attempt interactive SSH sessions or tunnels
- Each SSH command executes independently and terminates after completion
- For multiple commands, use separate SSH calls OR chain with && in a single call
