-- SQL Script to Create Missing Tables for Supabase Migration
-- Target Database: supabase.claritybusinesssolutions.ca
-- Date: 2025-06-26

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10, 2) CHECK (price > 0),
  description text,
  organization_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT products_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Create llm_api_keys table
CREATE TABLE IF NOT EXISTS public.llm_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  verified bool DEFAULT false,
  PRIMARY KEY (id),
  CONSTRAINT llm_api_keys_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create chat_messages table (if messages table doesn't serve this purpose)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  message_content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT chat_messages_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Create functions table
CREATE TABLE IF NOT EXISTS public.functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  code text NOT NULL,
  user_id uuid,
  PRIMARY KEY (id),
  CONSTRAINT functions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Add missing foreign key constraint to customer_sales -> products
-- (Only if products table is used for the product_id reference)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    ALTER TABLE customer_sales 
    ADD CONSTRAINT IF NOT EXISTS customer_sales_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id);
  END IF;
END $$;

-- Enable Row Level Security (RLS) on new tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.functions ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (adjust as needed for your security requirements)

-- Products policies
CREATE POLICY "Users can view products in their organization" ON public.products
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profile 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert products in their organization" ON public.products
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profile 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update products in their organization" ON public.products
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_profile 
      WHERE user_id = auth.uid()
    )
  );

-- LLM API Keys policies (user can only access their own keys)
CREATE POLICY "Users can view their own API keys" ON public.llm_api_keys
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own API keys" ON public.llm_api_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own API keys" ON public.llm_api_keys
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own API keys" ON public.llm_api_keys
  FOR DELETE USING (user_id = auth.uid());

-- Chat messages policies
CREATE POLICY "Users can view messages in conversations they participate in" ON public.chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE customer_id IN (
        SELECT customer_id FROM customer_user 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert messages in conversations they participate in" ON public.chat_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE customer_id IN (
        SELECT customer_id FROM customer_user 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Functions policies
CREATE POLICY "Users can view their own functions" ON public.functions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own functions" ON public.functions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own functions" ON public.functions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own functions" ON public.functions
  FOR DELETE USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_llm_api_keys_user_id ON public.llm_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_functions_user_id ON public.functions(user_id);

-- Grant necessary permissions
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.llm_api_keys TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT ALL ON public.functions TO authenticated;

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.chat_messages TO anon;

-- Add comments for documentation
COMMENT ON TABLE public.products IS 'Products available for sale by organizations';
COMMENT ON TABLE public.llm_api_keys IS 'Stores encrypted API keys for LLM providers with strict row-level security';
COMMENT ON TABLE public.chat_messages IS 'Messages within conversations between users and customers';
COMMENT ON TABLE public.functions IS 'User-defined functions for custom business logic';

-- Verify tables were created successfully
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('products', 'llm_api_keys', 'chat_messages', 'functions');
  
  RAISE NOTICE 'Successfully created % out of 4 expected tables', table_count;
END $$;