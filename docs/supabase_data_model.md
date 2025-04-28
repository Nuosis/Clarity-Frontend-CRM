# Supabase Data Model for Clarity Backend

This document describes the data model (DDL) for the Clarity Backend Supabase project. Each table is shown with its schema, columns, primary keys, and foreign key relationships.

---

## Table: organizations (public)

```sql
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- licenses.organization_id → organizations.id
-- customer_organization.organization_id → organizations.id
-- user_profile.organization_id → organizations.id
```

---

## Table: customers (public)

```sql
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  PRIMARY KEY (id)
);
-- Relationships:
-- customer_email.customer_id → customers.id
-- customer_phone.customer_id → customers.id
-- customer_organization.customer_id → customers.id
-- customer_user.customer_id → customers.id
-- customer_address.customer_id → customers.id
```

---

## Table: licenses (public)

```sql
CREATE TABLE public.licenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  license_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expiration_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- licenses.organization_id → organizations.id
-- license_modules.license_id → licenses.id
```

---

## Table: license_modules (public)

```sql
CREATE TABLE public.license_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL,
  module_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- license_modules.license_id → licenses.id
```

---

## Table: customer_email (public)

```sql
CREATE TABLE public.customer_email (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  email text NOT NULL,
  is_primary bool DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- customer_email.customer_id → customers.id
```

---

## Table: customer_phone (public)

```sql
CREATE TABLE public.customer_phone (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  phone text NOT NULL,
  type text,
  is_primary bool DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- customer_phone.customer_id → customers.id
```

---

## Table: customer_organization (public)

```sql
CREATE TABLE public.customer_organization (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- customer_organization.customer_id → customers.id
-- customer_organization.organization_id → organizations.id
```

---

## Table: customer_user (public)

```sql
CREATE TABLE public.customer_user (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- customer_user.customer_id → customers.id
-- customer_user.user_id → user_profile.user_id
```

---

## Table: customer_address (public)

```sql
CREATE TABLE public.customer_address (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  address_line1 text,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text,
  country text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- customer_address.customer_id → customers.id
```

---

## Table: user_profile (public)

```sql
CREATE TABLE public.user_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid UNIQUE,
  PRIMARY KEY (id)
);
-- Relationships:
-- user_profile.organization_id → organizations.id
-- user_profile.user_id → users.id
-- customer_user.user_id → user_profile.user_id
```

---

## Table: user_preferences (public)

```sql
CREATE TABLE public.user_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  preference_key text NOT NULL,
  preference_value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- user_preferences.user_id → users.id
```

---

## Table: llm_api_keys (public)

```sql
CREATE TABLE public.llm_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  verified bool DEFAULT false,
  PRIMARY KEY (id)
);
-- Relationships:
-- llm_api_keys.user_id → users.id
```

---

## Table: conversations (public)

```sql
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  subject text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid DEFAULT gen_random_uuid(),
  PRIMARY KEY (id)
);
-- Relationships:
-- conversations.user_id → users.id
-- chat_messages.conversation_id → conversations.id
```

---

## Table: chat_messages (public)

```sql
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  message_content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
-- Relationships:
-- chat_messages.conversation_id → conversations.id
```

---

## Table: functions (public)

```sql
CREATE TABLE public.functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  code text NOT NULL,
  user_id uuid,
  PRIMARY KEY (id)
);
-- Relationships:
-- functions.user_id → users.id
```

---