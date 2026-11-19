import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {api} from '../../src/lib/api';
import {Card,EmptyState,Field,Notice,PageTitle,PrimaryButton,Row,Screen,SectionTitle,ui} from '../../src/components/ui';
import {theme} from '../../src/constants/theme';
import type {PantryItem,Recipe} from '../../src/types';

type DraftIngredient={product_id:number;quantity:string};
const c=theme.colors;
const n=(value:string)=>Number(value.replace(',','.'));

export default function RecipesScreen(){
 const [rows,setRows]=useState<Recipe[]>([]);const [products,setProducts]=useState<PantryItem[]>([]);const [name,setName]=useState('');const [ingredients,setIngredients]=useState<DraftIngredient[]>([]);const [selected,setSelected]=useState<number|null>(null);const [quantity,setQuantity]=useState('1');const [picker,setPicker]=useState(false);const [editingId,setEditingId]=useState<number|null>(null);const [error,setError]=useState('');const [saving,setSaving]=useState(false);
 async function load(){try{const [recipes,pantry]=await Promise.all([api<Recipe[]>('/api/recipes'),api<PantryItem[]>('/api/pantry/items')]);setRows(recipes);setProducts(pantry);setError('')}catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar las recetas')}}
 useEffect(()=>{void load()},[]);
 const selectedProduct=products.find(x=>x.product_id===selected);
 async function addIngredient(){const amount=n(quantity);if(!selected||!Number.isFinite(amount)||amount<=0){setError('Elige un alimento y escribe una cantidad válida.');return}setIngredients(prev=>[...prev,{product_id:selected,quantity:String(amount)}]);setSelected(null);setQuantity('1');setPicker(false);setError('')}
 function clearForm(){setName('');setIngredients([]);setSelected(null);setQuantity('1');setPicker(false);setEditingId(null);setError('')}
 function edit(recipe:Recipe){setName(recipe.name);setIngredients(recipe.ingredients.map(item=>({product_id:item.product_id,quantity:String(item.quantity)})));setEditingId(recipe.id);setSelected(null);setQuantity('1');setPicker(false);setError('')}
 async function save(){if(!name.trim()||ingredients.length===0){setError('Pon un nombre y añade al menos un ingrediente de tu despensa.');return}setSaving(true);setError('');try{const body=JSON.stringify({name:name.trim(),ingredients:ingredients.map(x=>({product_id:x.product_id,quantity:n(x.quantity)}))});await api(editingId?`/api/recipes/${editingId}`:'/api/recipes',{method:editingId?'PUT':'POST',body});clearForm();await load()}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la receta.')}finally{setSaving(false)}}
 async function cook(recipe:Recipe){setError('');try{await api(`/api/recipes/${recipe.id}/cook`,{method:'POST',body:JSON.stringify({})});await load()}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar la receta.')}}
 function productName(id:number){const p=products.find(x=>x.product_id===id);return p?.name||'Alimento'}
 return <Screen>
  <PageTitle eyebrow="COCINA DE CASA" title="Recetas" subtitle="Guarda recetas con cantidades reales de tu despensa y registra cuándo las cocinas."/>
  {error?<Notice tone="error" message={error}/>:null}
  <Card><SectionTitle title={editingId?"Editar receta":"Nueva receta"}/><Field label="Nombre de la receta" value={name} onChangeText={setName} placeholder="Ej. Arroz con atún"/>
   <SectionTitle title="Ingredientes" detail={`${ingredients.length} añadidos`}/>
   {ingredients.map((item,index)=>{const p=products.find(x=>x.product_id===item.product_id);return <Row key={`${item.product_id}-${index}`} style={{justifyContent:'space-between'}}><Text style={ui.itemTitle}>{productName(item.product_id)}</Text><Text style={ui.muted}>{item.quantity} {p?.unit||''}</Text><Pressable onPress={()=>setIngredients(prev=>prev.filter((_,i)=>i!==index))}><Ionicons name="close-circle-outline" size={21} color={c.muted}/></Pressable></Row>})}
   {products.length===0?<Text style={ui.muted}>Primero añade alimentos en Despensa para poder elegirlos aquí.</Text>:<>
    <Pressable accessibilityRole="button" onPress={()=>setPicker(v=>!v)} style={{minHeight:46,borderWidth:1,borderColor:c.line,borderRadius:13,paddingHorizontal:12,justifyContent:'center'}}><Text style={{color:selectedProduct?c.ink:c.muted}}>{selectedProduct?`${selectedProduct.name} · ${selectedProduct.unit}`:'Elegir alimento de la despensa'}</Text></Pressable>
    {picker?<View style={{maxHeight:180,borderWidth:1,borderColor:c.line,borderRadius:12,overflow:'hidden'}}>{products.map(p=><Pressable key={p.product_id} onPress={()=>{setSelected(p.product_id);setPicker(false)}} style={{padding:11,borderBottomWidth:1,borderBottomColor:c.line,backgroundColor:'#FFFEFA'}}><Text style={ui.itemTitle}>{p.name}</Text><Text style={ui.muted}>{p.quantity} {p.unit} disponibles</Text></Pressable>)}</View>:null}
    {selectedProduct?<Row><Field label={`Cantidad (${selectedProduct.unit})`} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity}/><PrimaryButton title="Añadir ingrediente" icon="add" secondary onPress={addIngredient}/></Row>:null}
   </>}
   <PrimaryButton title={saving?'Guardando…':editingId?'Guardar cambios':'Guardar receta'} icon="checkmark" onPress={save} disabled={saving}/>{editingId?<PrimaryButton title="Cancelar edición" secondary onPress={clearForm}/>:null}
  </Card>
  <SectionTitle title="Tus recetas" detail={`${rows.length} guardadas`}/>
  {rows.length===0?<EmptyState title="Aún no hay recetas" detail="Crea una receta y la app comprobará si tienes lo necesario para prepararla."/>:rows.map(recipe=><Card key={recipe.id}>
   <Row style={{justifyContent:'space-between'}}><View style={{flex:1}}><Text style={ui.itemTitle}>{recipe.name}</Text>{recipe.last_cooked_on?<Text style={ui.muted}>Última vez: {recipe.last_cooked_on}</Text>:null}</View><View style={{paddingHorizontal:10,paddingVertical:6,borderRadius:999,backgroundColor:recipe.can_make?c.greenSoft:c.coralSoft}}><Text style={{color:recipe.can_make?c.greenDark:c.danger,fontSize:12,fontWeight:'700'}}>{recipe.can_make?'La puedes hacer':'Faltan ingredientes'}</Text></View></Row>
   <View style={{gap:7,marginTop:4}}>{recipe.ingredients.map((item,i)=><Text key={`${item.product_id}-${i}`} style={ui.muted}>• {item.product_name}: {item.quantity} {item.unit}{item.pantry_quantity<item.quantity?` (tienes ${item.pantry_quantity} ${item.unit})`:''}</Text>)}</View>
   <PrimaryButton title="Editar receta" icon="create-outline" secondary onPress={()=>edit(recipe)}/>
   {recipe.can_make?<PrimaryButton title="La he cocinado hoy · descontar ingredientes" icon="checkmark-done" onPress={()=>void cook(recipe)}/>:null}
  </Card>)}
 </Screen>
}
