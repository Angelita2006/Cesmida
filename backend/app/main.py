from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "")
engine = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
app = FastAPI(title="Cesmida API", version="0.1.0", description="Despensa y finanzas personales")
origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


@contextmanager
def db():
    if engine is None:
        raise HTTPException(503, "Configura DATABASE_URL en backend/.env para conectar con houseStore.")
    try:
        with engine.begin() as conn:
            yield conn
    except SQLAlchemyError as exc:
        raise HTTPException(503, f"No se pudo consultar houseStore: {exc.__class__.__name__}") from exc


def rows(conn, query: str, params: dict[str, Any] | None = None):
    return [dict(x) for x in conn.execute(text(query), params or {}).mappings().all()]


@app.on_event("startup")
def create_recipe_cooking_log():
    if engine is None:
        return
    with engine.begin() as conn:
        conn.execute(text("""CREATE TABLE IF NOT EXISTS recipe_cookings (
            id BIGSERIAL PRIMARY KEY,
            recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            cooked_on DATE NOT NULL DEFAULT CURRENT_DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"""))


class PantryInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    brand: str | None = None
    category: str | None = "Otros"
    quantity: Decimal = Field(default=Decimal(0), ge=0)
    unit: str = "ud"
    ideal_quantity: Decimal | None = Field(default=None, ge=0)


class ShoppingInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: Decimal = Field(default=Decimal(1), gt=0)
    unit: str = "ud"


class ShoppingUpdate(BaseModel):
    purchased: bool


class RecipeIngredientInput(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)


class RecipeInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    ingredients: list[RecipeIngredientInput] = []
    servings: int | None = Field(default=None, gt=0)
    prep_minutes: int | None = Field(default=None, ge=0)
    instructions: str | None = None


class CookInput(BaseModel):
    cooked_on: date = Field(default_factory=date.today)


class TransactionInput(BaseModel):
    amount_eur: Decimal = Field(gt=0)
    description: str = Field(min_length=1, max_length=250)
    category: str = "Extra"
    kind: str = "expense"
    occurred_on: date = Field(default_factory=date.today)


@app.get("/api/health")
def health():
    if engine is None:
        return {"status": "needs_database_url", "database": "houseStore"}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "houseStore"}
    except SQLAlchemyError:
        raise HTTPException(503, "PostgreSQL no está disponible.")


@app.get("/api/dashboard")
def dashboard():
    with db() as conn:
        pantry = rows(conn, "SELECT COUNT(DISTINCT product_id) AS products, COALESCE(SUM(quantity),0) AS units FROM pantry_stock WHERE quantity > 0")[0]
        return {
            "pantry_products": pantry["products"], "pantry_units": pantry["units"],
            "expiring_soon": rows(conn, "SELECT COUNT(*) AS n FROM pantry_expiring_soon")[0]["n"],
            "shopping_pending": rows(conn, "SELECT COUNT(*) AS n FROM shopping_items si JOIN shopping_lists sl ON sl.id=si.list_id WHERE NOT si.purchased AND sl.status='open'")[0]["n"],
            "recipes": rows(conn, "SELECT COUNT(*) AS n FROM recipes")[0]["n"],
            "month_income_eur": rows(conn, "SELECT COALESCE(SUM(amount_eur),0) AS n FROM finance_transactions WHERE kind='income' AND date_trunc('month',occurred_on)=date_trunc('month',CURRENT_DATE)")[0]["n"],
            "month_expenses_eur": rows(conn, "SELECT COALESCE(SUM(amount_eur),0) AS n FROM finance_transactions WHERE kind='expense' AND date_trunc('month',occurred_on)=date_trunc('month',CURRENT_DATE)")[0]["n"],
            "month_savings_eur": rows(conn, "SELECT COALESCE(SUM(amount_eur),0) AS n FROM finance_transactions WHERE kind='saving' AND date_trunc('month',occurred_on)=date_trunc('month',CURRENT_DATE)")[0]["n"],
        }


@app.get("/api/pantry/items")
def pantry_items():
    with db() as conn:
        return rows(conn, """SELECT p.id,p.id AS product_id,p.name,p.brand,c.name AS category,
            COALESCE(SUM(ps.quantity),0) AS quantity,p.default_unit AS unit,p.minimum_stock AS ideal_quantity
            FROM products p LEFT JOIN pantry_stock ps ON ps.product_id=p.id
            LEFT JOIN categories c ON c.id=p.category_id GROUP BY p.id,c.name ORDER BY p.name""")


def pantry_item_row(conn, product_id: int):
    return rows(conn, """SELECT p.id,p.id AS product_id,p.name,p.brand,c.name AS category,
        COALESCE(SUM(ps.quantity),0) AS quantity,p.default_unit AS unit,p.minimum_stock AS ideal_quantity
        FROM products p LEFT JOIN pantry_stock ps ON ps.product_id=p.id
        LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=:id GROUP BY p.id,c.name""", {"id": product_id})[0]


def save_pantry_item(item: PantryInput, product_id: int | None = None):
    with db() as conn:
        category = conn.execute(text("INSERT INTO categories(name,kind) VALUES (:name,'food') ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id"), {"name": item.category or "Otros"}).scalar_one()
        unit = item.unit.strip() or "ud"
        if product_id is None:
            product_id = conn.execute(text("""INSERT INTO products(name,brand,category_id,default_unit,minimum_stock)
                VALUES (:name,:brand,:category,:unit,:ideal)
                ON CONFLICT(name,brand) DO UPDATE SET category_id=EXCLUDED.category_id,
                    default_unit=EXCLUDED.default_unit,minimum_stock=EXCLUDED.minimum_stock
                RETURNING id"""), {"name":item.name.strip(),"brand":item.brand or None,"category":category,"unit":unit,"ideal":item.ideal_quantity}).scalar_one()
        else:
            result=conn.execute(text("""UPDATE products SET name=:name,brand=:brand,category_id=:category,
                default_unit=:unit,minimum_stock=:ideal WHERE id=:id"""), {"name":item.name.strip(),"brand":item.brand or None,"category":category,"unit":unit,"ideal":item.ideal_quantity,"id":product_id})
            if not result.rowcount: raise HTTPException(404,"Alimento no encontrado")
        stocks=rows(conn,"SELECT id,quantity FROM pantry_stock WHERE product_id=:id ORDER BY expires_on NULLS LAST,id FOR UPDATE",{"id":product_id})
        before=sum((Decimal(x["quantity"]) for x in stocks),Decimal(0))
        if stocks:
            conn.execute(text("UPDATE pantry_stock SET quantity=0 WHERE product_id=:id"),{"id":product_id})
            stock_id=stocks[0]["id"]
            conn.execute(text("UPDATE pantry_stock SET quantity=:quantity,unit=:unit WHERE id=:id"),{"quantity":item.quantity,"unit":unit,"id":stock_id})
        else:
            stock_id=conn.execute(text("INSERT INTO pantry_stock(product_id,quantity,unit) VALUES (:product,:quantity,:unit) RETURNING id"),{"product":product_id,"quantity":item.quantity,"unit":unit}).scalar_one()
        change=abs(item.quantity-before)
        if change>0:
            movement="purchase" if item.quantity>before else "adjustment"
            conn.execute(text("INSERT INTO pantry_movements(stock_id,product_id,movement_type,quantity,unit,notes) VALUES (:stock,:product,:movement,:quantity,:unit,'Actualización de cantidad en Cesmida')"),{"stock":stock_id,"product":product_id,"movement":movement,"quantity":change,"unit":unit})
        return pantry_item_row(conn,product_id)


@app.post("/api/pantry/items")
def add_pantry_item(item: PantryInput):
    return save_pantry_item(item)


@app.put("/api/pantry/items/{product_id}")
def update_pantry_item(product_id: int, item: PantryInput):
    return save_pantry_item(item,product_id)


def active_list_id(conn):
    return conn.execute(text("INSERT INTO shopping_lists(status) VALUES ('open') RETURNING id")).scalar_one()


@app.get("/api/shopping/items")
def shopping_items():
    with db() as conn:
        list_id=conn.execute(text("SELECT id FROM shopping_lists WHERE status='open' ORDER BY created_on DESC,id DESC LIMIT 1")).scalar_one_or_none()
        if list_id is None: return []
        return rows(conn, """SELECT si.id,p.id AS product_id,p.name AS product_name,si.quantity,si.unit,si.purchased
            FROM shopping_items si JOIN products p ON p.id=si.product_id
            WHERE si.list_id=:id ORDER BY si.purchased,p.name""", {"id":list_id})


@app.post("/api/shopping/generate")
def generate_shopping_list():
    with db() as conn:
        list_id=conn.execute(text("SELECT id FROM shopping_lists WHERE status='open' ORDER BY created_on DESC,id DESC LIMIT 1")).scalar_one_or_none()
        if list_id is None:
            list_id=active_list_id(conn)
        else:
            conn.execute(text("DELETE FROM shopping_items WHERE list_id=:id AND notes='cesmida:pantry-generated'"),{"id":list_id})
        deficits=rows(conn,"""SELECT p.id,GREATEST(p.minimum_stock-COALESCE(SUM(ps.quantity),0),0) AS needed,p.default_unit AS unit
            FROM products p LEFT JOIN pantry_stock ps ON ps.product_id=p.id
            WHERE p.minimum_stock IS NOT NULL GROUP BY p.id
            HAVING COALESCE(SUM(ps.quantity),0)<p.minimum_stock ORDER BY p.name""")
        for item in deficits:
            conn.execute(text("INSERT INTO shopping_items(list_id,product_id,quantity,unit,notes) VALUES (:list,:product,:quantity,:unit,'cesmida:pantry-generated')"),{"list":list_id,"product":item["id"],"quantity":item["needed"],"unit":item["unit"]})
        return rows(conn,"""SELECT si.id,p.id AS product_id,p.name AS product_name,si.quantity,si.unit,si.purchased
            FROM shopping_items si JOIN products p ON p.id=si.product_id WHERE si.list_id=:id ORDER BY p.name""",{"id":list_id})


@app.post("/api/shopping/items")
def add_shopping_item(item: ShoppingInput):
    with db() as conn:
        product=conn.execute(text("SELECT id FROM products WHERE lower(name)=lower(:name) ORDER BY id LIMIT 1"), {"name":item.name.strip()}).scalar_one_or_none()
        if product is None:
            product=conn.execute(text("INSERT INTO products(name,default_unit) VALUES (:name,:unit) RETURNING id"), {"name":item.name.strip(),"unit":item.unit}).scalar_one()
        list_id=conn.execute(text("SELECT id FROM shopping_lists WHERE status='open' ORDER BY created_on DESC,id DESC LIMIT 1")).scalar_one_or_none() or active_list_id(conn)
        conn.execute(text("INSERT INTO shopping_items(list_id,product_id,quantity,unit) VALUES (:list,:product,:quantity,:unit)"), {"list":list_id,"product":product,"quantity":item.quantity,"unit":item.unit})
        return {"ok":True}


@app.patch("/api/shopping/items/{item_id}")
def update_shopping_item(item_id:int, update:ShoppingUpdate):
    with db() as conn:
        result=conn.execute(text("UPDATE shopping_items SET purchased=:purchased WHERE id=:id"), {"purchased":update.purchased,"id":item_id})
        if not result.rowcount: raise HTTPException(404,"Producto de compra no encontrado")
        return {"ok":True}


@app.get("/api/recipes")
def recipes():
    with db() as conn:
        return rows(conn, """SELECT r.id,r.name,r.servings,r.prep_minutes,r.instructions,r.favorite,
            COALESCE(json_agg(json_build_object('product_id',p.id,'product_name',p.name,'quantity',ri.quantity,
                'unit',ri.unit,'pantry_quantity',COALESCE(stock.quantity,0)) ORDER BY p.name)
                FILTER (WHERE p.id IS NOT NULL),'[]') AS ingredients,
            (EXISTS (SELECT 1 FROM recipe_ingredients has_ri WHERE has_ri.recipe_id=r.id) AND NOT EXISTS (SELECT 1 FROM recipe_ingredients check_ri
                LEFT JOIN (SELECT product_id,SUM(quantity) AS quantity FROM pantry_stock GROUP BY product_id) check_stock ON check_stock.product_id=check_ri.product_id
                WHERE check_ri.recipe_id=r.id AND check_ri.quantity>COALESCE(check_stock.quantity,0))) AS can_make,
            (SELECT MAX(cooked_on) FROM recipe_cookings rc WHERE rc.recipe_id=r.id) AS last_cooked_on
            FROM recipes r LEFT JOIN recipe_ingredients ri ON ri.recipe_id=r.id LEFT JOIN products p ON p.id=ri.product_id
            LEFT JOIN (SELECT product_id,SUM(quantity) AS quantity FROM pantry_stock GROUP BY product_id) stock ON stock.product_id=p.id
            GROUP BY r.id ORDER BY can_make DESC,r.favorite DESC,r.name""")


@app.post("/api/recipes")
def add_recipe(recipe:RecipeInput):
    with db() as conn:
        recipe_id=conn.execute(text("INSERT INTO recipes(name,servings,prep_minutes,instructions) VALUES (:name,:servings,:minutes,:instructions) RETURNING id"), {"name":recipe.name.strip(),"servings":recipe.servings,"minutes":recipe.prep_minutes,"instructions":recipe.instructions}).scalar_one()
        combined: dict[int,Decimal]={}
        for ingredient in recipe.ingredients:
            combined[ingredient.product_id]=combined.get(ingredient.product_id,Decimal(0))+ingredient.quantity
        for product_id,quantity in combined.items():
            unit=conn.execute(text("SELECT default_unit FROM products WHERE id=:id"),{"id":product_id}).scalar_one_or_none()
            if unit is None: raise HTTPException(422,f"El alimento {product_id} no existe en la despensa")
            conn.execute(text("INSERT INTO recipe_ingredients(recipe_id,product_id,quantity,unit) VALUES (:recipe,:product,:quantity,:unit)"),{"recipe":recipe_id,"product":product_id,"quantity":quantity,"unit":unit})
        return {"id":recipe_id,"name":recipe.name}


@app.put("/api/recipes/{recipe_id}")
def update_recipe(recipe_id:int,recipe:RecipeInput):
    with db() as conn:
        exists=conn.execute(text("SELECT id FROM recipes WHERE id=:id"),{"id":recipe_id}).scalar_one_or_none()
        if exists is None: raise HTTPException(404,"Receta no encontrada")
        combined: dict[int,Decimal]={}
        for ingredient in recipe.ingredients:
            combined[ingredient.product_id]=combined.get(ingredient.product_id,Decimal(0))+ingredient.quantity
        units={}
        for product_id in combined:
            unit=conn.execute(text("SELECT default_unit FROM products WHERE id=:id"),{"id":product_id}).scalar_one_or_none()
            if unit is None: raise HTTPException(422,f"El alimento {product_id} no existe en la despensa")
            units[product_id]=unit
        conn.execute(text("UPDATE recipes SET name=:name,servings=:servings,prep_minutes=:minutes,instructions=:instructions WHERE id=:id"),{"name":recipe.name.strip(),"servings":recipe.servings,"minutes":recipe.prep_minutes,"instructions":recipe.instructions,"id":recipe_id})
        conn.execute(text("DELETE FROM recipe_ingredients WHERE recipe_id=:id"),{"id":recipe_id})
        for product_id,quantity in combined.items():
            conn.execute(text("INSERT INTO recipe_ingredients(recipe_id,product_id,quantity,unit) VALUES (:recipe,:product,:quantity,:unit)"),{"recipe":recipe_id,"product":product_id,"quantity":quantity,"unit":units[product_id]})
        return {"id":recipe_id,"name":recipe.name}


@app.post("/api/recipes/{recipe_id}/cook")
def cook_recipe(recipe_id:int,payload:CookInput):
    with db() as conn:
        recipe=conn.execute(text("SELECT name FROM recipes WHERE id=:id"),{"id":recipe_id}).scalar_one_or_none()
        if recipe is None: raise HTTPException(404,"Receta no encontrada")
        ingredients=rows(conn,"SELECT product_id,quantity,unit FROM recipe_ingredients WHERE recipe_id=:id",{"id":recipe_id})
        locked_stocks:dict[int,list[dict[str,Any]]]={}
        missing=[]
        for ingredient in ingredients:
            stocks=rows(conn,"SELECT id,quantity FROM pantry_stock WHERE product_id=:id ORDER BY expires_on NULLS LAST,id FOR UPDATE",{"id":ingredient["product_id"]})
            locked_stocks[ingredient["product_id"]]=stocks
            available=sum((Decimal(stock["quantity"]) for stock in stocks),Decimal(0))
            if available<Decimal(ingredient["quantity"]):
                product_name=conn.execute(text("SELECT name FROM products WHERE id=:id"),{"id":ingredient["product_id"]}).scalar_one()
                missing.append({"name":product_name,"needed":ingredient["quantity"],"available":available,"unit":ingredient["unit"]})
        if missing: raise HTTPException(409,{"message":"No hay cantidad suficiente para preparar esta receta","missing":missing})
        for ingredient in ingredients:
            remaining=Decimal(ingredient["quantity"])
            for stock in locked_stocks[ingredient["product_id"]]:
                used=min(Decimal(stock["quantity"]),remaining)
                if used>0:
                    conn.execute(text("UPDATE pantry_stock SET quantity=quantity-:used WHERE id=:id"),{"used":used,"id":stock["id"]})
                    conn.execute(text("INSERT INTO pantry_movements(stock_id,product_id,movement_type,quantity,unit,notes) VALUES (:stock,:product,'consume',:quantity,:unit,:notes)"),{"stock":stock["id"],"product":ingredient["product_id"],"quantity":used,"unit":ingredient["unit"],"notes":f"Receta: {recipe}"})
                    remaining-=used
                if remaining<=0: break
        conn.execute(text("INSERT INTO recipe_cookings(recipe_id,cooked_on) VALUES (:recipe,:day)"),{"recipe":recipe_id,"day":payload.cooked_on})
        return {"ok":True,"recipe":recipe,"cooked_on":payload.cooked_on}


@app.get("/api/recipes/ingredients/pairs")
def recipe_pairs():
    with db() as conn: return rows(conn,"SELECT ingredient_1,ingredient_2,recipes_together FROM recipe_ingredient_pairs ORDER BY recipes_together DESC LIMIT 20")


@app.get("/api/finance/summary")
def finance_summary():
    with db() as conn:
        totals=rows(conn,"SELECT COALESCE(SUM(amount_eur) FILTER (WHERE kind='income'),0) AS income,COALESCE(SUM(amount_eur) FILTER (WHERE kind='expense'),0) AS expenses,COALESCE(SUM(amount_eur) FILTER (WHERE kind='saving'),0) AS savings FROM finance_transactions WHERE date_trunc('month',occurred_on)=date_trunc('month',CURRENT_DATE)")[0]
        totals["transactions"]=rows(conn,"SELECT ft.id,ft.occurred_on,ft.amount_eur,ft.kind,fc.name AS category_name,ft.description FROM finance_transactions ft LEFT JOIN finance_categories fc ON fc.id=ft.category_id WHERE date_trunc('month',ft.occurred_on)=date_trunc('month',CURRENT_DATE) ORDER BY ft.occurred_on DESC,ft.id DESC LIMIT 30")
        totals["categories"]=rows(conn,"SELECT fc.name,fc.kind,COALESCE(SUM(ft.amount_eur),0) AS total_eur FROM finance_categories fc LEFT JOIN finance_transactions ft ON ft.category_id=fc.id AND date_trunc('month',ft.occurred_on)=date_trunc('month',CURRENT_DATE) GROUP BY fc.id ORDER BY fc.name")
        return totals


@app.post("/api/finance/transactions")
def add_transaction(tx:TransactionInput):
    if tx.kind not in {"income","expense","saving"}: raise HTTPException(422,"Tipo de movimiento inválido")
    with db() as conn:
        category=conn.execute(text("SELECT id FROM finance_categories WHERE lower(name)=lower(:name) AND kind=:kind ORDER BY id LIMIT 1"), {"name":tx.category.strip(),"kind":tx.kind}).scalar_one_or_none()
        if category is None:
            category=conn.execute(text("INSERT INTO finance_categories(name,kind) VALUES (:name,:kind) RETURNING id"), {"name":tx.category.strip(),"kind":tx.kind}).scalar_one()
        tx_id=conn.execute(text("INSERT INTO finance_transactions(occurred_on,amount_eur,kind,category_id,description) VALUES (:day,:amount,:kind,:category,:description) RETURNING id"), {"day":tx.occurred_on,"amount":tx.amount_eur,"kind":tx.kind,"category":category,"description":tx.description.strip()}).scalar_one()
        return {"id":tx_id,"ok":True}
