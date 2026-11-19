CREATE TYPE category_kind AS ENUM ('food','household','income','expense','saving');
CREATE TYPE pantry_movement_type AS ENUM ('purchase','consume','adjustment','waste');
CREATE TYPE shopping_status AS ENUM ('open','completed','archived');
CREATE TYPE finance_kind AS ENUM ('income','expense','saving');

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, kind category_kind NOT NULL DEFAULT 'food'
);
CREATE TABLE stores (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, location TEXT, notes TEXT
);
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, category_id BIGINT REFERENCES categories(id),
  brand TEXT, barcode TEXT, default_unit TEXT NOT NULL DEFAULT 'ud', preferred BOOLEAN NOT NULL DEFAULT FALSE,
  minimum_stock NUMERIC(12,3), notes TEXT, UNIQUE NULLS NOT DISTINCT(name, brand)
);
CREATE TABLE price_observations (
  id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id BIGINT NOT NULL REFERENCES stores(id), observed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  price_eur NUMERIC(12,2) NOT NULL CHECK(price_eur >= 0), package_quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  package_unit TEXT NOT NULL DEFAULT 'ud', unit_price_eur NUMERIC(12,4) GENERATED ALWAYS AS (price_eur / NULLIF(package_quantity,0)) STORED,
  promotion TEXT, notes TEXT
);
CREATE TABLE pantry_stock (
  id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id), quantity NUMERIC(12,3) NOT NULL CHECK(quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'ud', location TEXT, purchased_on DATE, expires_on DATE, opened_on DATE,
  purchase_price_eur NUMERIC(12,2) CHECK(purchase_price_eur >= 0), store_id BIGINT REFERENCES stores(id), notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pantry_movements (
  id BIGSERIAL PRIMARY KEY, stock_id BIGINT REFERENCES pantry_stock(id) ON DELETE SET NULL,
  product_id BIGINT NOT NULL REFERENCES products(id), movement_type pantry_movement_type NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK(quantity > 0), unit TEXT NOT NULL DEFAULT 'ud', moved_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT
);
CREATE TABLE inventory_counts (
  id BIGSERIAL PRIMARY KEY, counted_on DATE NOT NULL DEFAULT CURRENT_DATE, product_id BIGINT NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,3) NOT NULL CHECK(quantity >= 0), unit TEXT NOT NULL DEFAULT 'ud', notes TEXT
);
CREATE TABLE recipes (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, servings INTEGER CHECK(servings > 0), prep_minutes INTEGER CHECK(prep_minutes >= 0),
  instructions TEXT, notes TEXT, favorite BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE recipe_ingredients (
  recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, product_id BIGINT NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'ud', optional BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(recipe_id,product_id)
);
CREATE TABLE shopping_lists (
  id BIGSERIAL PRIMARY KEY, created_on DATE NOT NULL DEFAULT CURRENT_DATE, planned_for DATE,
  status shopping_status NOT NULL DEFAULT 'open', notes TEXT
);
CREATE TABLE shopping_items (
  id BIGSERIAL PRIMARY KEY, list_id BIGINT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id), quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ud', chosen_store_id BIGINT REFERENCES stores(id), estimated_unit_price_eur NUMERIC(12,4),
  purchased BOOLEAN NOT NULL DEFAULT FALSE, notes TEXT
);
CREATE TABLE finance_categories (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, kind finance_kind NOT NULL, UNIQUE(name,kind)
);
CREATE TABLE finance_transactions (
  id BIGSERIAL PRIMARY KEY, occurred_on DATE NOT NULL DEFAULT CURRENT_DATE, amount_eur NUMERIC(12,2) NOT NULL CHECK(amount_eur >= 0),
  kind finance_kind NOT NULL, category_id BIGINT REFERENCES finance_categories(id), description TEXT NOT NULL,
  merchant TEXT, recurring BOOLEAN NOT NULL DEFAULT FALSE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE monthly_budgets (
  id BIGSERIAL PRIMARY KEY, month DATE NOT NULL, category_id BIGINT NOT NULL REFERENCES finance_categories(id),
  planned_amount_eur NUMERIC(12,2) NOT NULL CHECK(planned_amount_eur >= 0), UNIQUE(month,category_id)
);
CREATE TABLE savings_goals (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, target_amount_eur NUMERIC(12,2) NOT NULL CHECK(target_amount_eur > 0),
  current_amount_eur NUMERIC(12,2) NOT NULL DEFAULT 0, target_date DATE, notes TEXT
);

CREATE INDEX pantry_product_idx ON pantry_stock(product_id);
CREATE INDEX pantry_expiry_idx ON pantry_stock(expires_on) WHERE quantity > 0;
CREATE INDEX prices_product_store_date_idx ON price_observations(product_id,store_id,observed_on DESC);
CREATE INDEX finance_date_kind_idx ON finance_transactions(occurred_on,kind);
CREATE INDEX shopping_list_open_idx ON shopping_lists(status,created_on DESC);

CREATE VIEW pantry_totals AS
  SELECT p.id AS product_id,p.name,p.brand,COALESCE(SUM(ps.quantity),0) AS quantity,MIN(ps.unit) AS unit
  FROM products p LEFT JOIN pantry_stock ps ON ps.product_id=p.id GROUP BY p.id;
CREATE VIEW pantry_expiring_soon AS
  SELECT ps.id AS stock_id,ps.product_id,p.name,ps.quantity,ps.unit,ps.expires_on
  FROM pantry_stock ps JOIN products p ON p.id=ps.product_id
  WHERE ps.quantity>0 AND ps.expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE+7;
CREATE VIEW latest_store_prices AS
  SELECT DISTINCT ON (product_id,store_id) product_id,store_id,observed_on,price_eur,package_quantity,package_unit,unit_price_eur
  FROM price_observations ORDER BY product_id,store_id,observed_on DESC,id DESC;
CREATE VIEW best_store_prices AS
  SELECT DISTINCT ON (product_id) product_id,store_id,observed_on,price_eur,package_quantity,package_unit,unit_price_eur
  FROM latest_store_prices ORDER BY product_id,unit_price_eur ASC;
CREATE VIEW weekly_shopping_candidates AS
  SELECT pt.product_id,pt.name,pt.quantity,pt.unit,p.minimum_stock
  FROM pantry_totals pt JOIN products p ON p.id=pt.product_id
  WHERE p.minimum_stock IS NOT NULL AND pt.quantity<=p.minimum_stock;
CREATE VIEW recipe_ingredient_pairs AS
  SELECT p1.name AS ingredient_1,p2.name AS ingredient_2,COUNT(DISTINCT ri1.recipe_id) AS recipes_together
  FROM recipe_ingredients ri1 JOIN recipe_ingredients ri2 ON ri1.recipe_id=ri2.recipe_id AND ri1.product_id<ri2.product_id
  JOIN products p1 ON p1.id=ri1.product_id JOIN products p2 ON p2.id=ri2.product_id
  GROUP BY p1.name,p2.name;
CREATE VIEW monthly_finance_summary AS
  SELECT date_trunc('month',occurred_on)::date AS month,kind,SUM(amount_eur) AS amount_eur
  FROM finance_transactions GROUP BY date_trunc('month',occurred_on)::date,kind;

INSERT INTO categories(name,kind) VALUES ('Alimentos','food'),('Hogar','household') ON CONFLICT DO NOTHING;
INSERT INTO finance_categories(name,kind) VALUES
  ('Alquiler','expense'),('Agua','expense'),('Luz','expense'),('Comida','expense'),('Extra','expense'),
  ('Ahorro','saving'),('Ingresos','income') ON CONFLICT DO NOTHING;
