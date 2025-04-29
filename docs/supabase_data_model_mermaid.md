# Supabase Data Model – Mermaid ER Diagram

> **Note:** To zoom and pan this diagram, copy the code block below and paste it into [https://mermaid.live](https://mermaid.live) or another Mermaid live editor. Markdown previewers (including VSCode) do not support zooming or panning for Mermaid diagrams.

```mermaid
erDiagram
  organizations {
    uuid id
    text name
    timestamptz created_at
    timestamptz updated_at
  }
  customers {
    uuid id
    text name
    timestamptz created_at
    timestamptz updated_at
    text first_name
    text last_name
  }
  licenses {
    uuid id
    uuid organization_id
    uuid license_key
    timestamptz expiration_date
    timestamptz created_at
    timestamptz updated_at
  }
  license_modules {
    uuid id
    uuid license_id
    uuid module_id
    timestamptz created_at
  }
  customer_email {
    uuid id
    uuid customer_id
    text email
    bool is_primary
    timestamptz created_at
    timestamptz updated_at
  }
  customer_phone {
    uuid id
    uuid customer_id
    text phone
    text type
    bool is_primary
    timestamptz created_at
    timestamptz updated_at
  }
  customer_organization {
    uuid id
    uuid customer_id
    uuid organization_id
    timestamptz created_at
  }
  customer_user {
    uuid id
    uuid customer_id
    uuid user_id
    timestamptz created_at
  }
  customer_address {
    uuid id
    uuid customer_id
    text address_line1
    text address_line2
    text city
    text state
    text postal_code
    text country
    timestamptz created_at
    timestamptz updated_at
  }
  user_profile {
    uuid id
    uuid organization_id
    text role
    timestamptz created_at
    timestamptz updated_at
    uuid user_id
  }
  user_preferences {
    uuid id
    uuid user_id
    text preference_key
    jsonb preference_value
    timestamptz created_at
    timestamptz updated_at
  }
  llm_api_keys {
    uuid id
    uuid user_id
    text provider
    text api_key
    timestamptz created_at
    timestamptz updated_at
    bool verified
  }
  conversations {
    uuid id
    text title
    text subject
    timestamptz created_at
    timestamptz updated_at
    uuid user_id
  }
  chat_messages {
    uuid id
    uuid conversation_id
    text message_content
    timestamptz created_at
    timestamptz updated_at
  }
  functions {
    uuid id
    uuid created_by
    text name
    text description
    timestamptz created_at
    timestamptz updated_at
    text code
    uuid user_id
  }
  products {
    uuid id
    text name
    numeric price
    text description
    uuid organization_id
    timestamptz created_at
    timestamptz updated_at
  }
  customer_sales {
    uuid id
    uuid customer_id
    uuid product_id
    text product_name
    timestamptz sale_date
    numeric quantity
    numeric unit_price
    numeric total_price
    timestamptz created_at
    timestamptz updated_at
  }

  licenses }o--|| organizations : organization_id
  products }o--|| organizations : organization_id
  license_modules }o--|| licenses : license_id
  customer_email }o--|| customers : customer_id
  customer_phone }o--|| customers : customer_id
  customer_organization }o--|| customers : customer_id
  customer_organization }o--|| organizations : organization_id
  customer_user }o--|| customers : customer_id
  customer_user }o--|| user_profile : user_id
  customer_address }o--|| customers : customer_id
  user_profile }o--|| organizations : organization_id
  user_profile }o--|| users : user_id
  user_preferences }o--|| users : user_id
  llm_api_keys }o--|| users : user_id
  conversations }o--|| users : user_id
  chat_messages }o--|| conversations : conversation_id
  functions }o--|| users : user_id
  customer_sales }o--|| customers : customer_id
  customer_sales }o--|| products : product_id