export interface DashboardSummary { pantry_products:number; pantry_units:number; expiring_soon:number; shopping_pending:number; recipes:number; month_income_eur:number; month_expenses_eur:number; month_savings_eur:number }
export interface PantryItem { id:number; product_id:number; name:string; brand:string|null; category:string|null; quantity:number; unit:string; ideal_quantity:number|null }
export interface ShoppingItem { id:number; product_id:number; product_name:string; quantity:number; unit:string; purchased:boolean }
export interface ShoppingList { list_id:number|null; planned_for:string|null; items:ShoppingItem[] }
export interface RecipeIngredient { product_id:number; product_name:string; quantity:number; unit:string; pantry_quantity:number }
export interface Recipe { id:number; name:string; servings:number|null; prep_minutes:number|null; instructions:string|null; favorite:boolean; can_make:boolean; last_cooked_on:string|null; ingredients:RecipeIngredient[] }
export interface RecipePair { ingredient_1:string; ingredient_2:string; recipes_together:number }
export interface FinanceCategory { name:string; kind:"income"|"expense"|"saving"; total_eur:number }
export interface FinanceSummary { month:string; income_eur:number; expenses_eur:number; savings_eur:number; categories:FinanceCategory[] }
