CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO products (name, vendor_id, price_cents, stock) VALUES
  ('Farmhouse Sourdough', 'vendor-1', 550, 12),
  ('Seasonal Vegetable Box', 'vendor-1', 899, 8),
  ('Single-Origin Coffee', 'vendor-2', 1299, 5);
