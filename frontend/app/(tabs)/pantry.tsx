import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, EmptyState, Field, Notice, PageTitle, PrimaryButton, Row, Screen, SectionTitle, styles } from "../../src/components/ui";
import { theme } from "../../src/constants/theme";
import { api } from "../../src/lib/api";
import type { PantryItem } from "../../src/types";

const c=theme.colors;
const fresh=()=>({name:"",brand:"",quantity:"0",unit:"ud",category:"Alimentos",ideal_quantity:""});
const numberValue=(value:string)=>Number(value.replace(",","."));

export default function PantryScreen(){
 const [items,setItems]=useState<PantryItem[]>([]);const [form,setForm]=useState(fresh());const [editing,setEditing]=useState<number|null>(null);const [open,setOpen]=useState(false);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);try{setItems(await api<PantryItem[]>("/api/pantry/items"));setError("")}catch(e){setError(e instanceof Error?e.message:"No se pudo cargar la despensa.")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const set=(key:keyof ReturnType<typeof fresh>,value:string)=>setForm(prev=>({...prev,[key]:value}));
 const startAdd=()=>{setForm(fresh());setEditing(null);setError("");setOpen(true)};
 const startEdit=(item:PantryItem)=>{setForm({name:item.name,brand:item.brand||"",quantity:String(item.quantity),unit:item.unit,category:item.category||"Alimentos",ideal_quantity:item.ideal_quantity==null?"":String(item.ideal_quantity)});setEditing(item.product_id);setError("");setOpen(true)};
 const save=async()=>{const quantity=numberValue(form.quantity);const ideal=form.ideal_quantity.trim()===""?null:numberValue(form.ideal_quantity);if(!form.name.trim()||!Number.isFinite(quantity)||quantity<0|| (ideal!==null&&(!Number.isFinite(ideal)||ideal<0))){setError("Revisa el nombre y las cantidades. Puedes indicar cero si no tienes existencias.");return}setSaving(true);setError("");try{const body=JSON.stringify({...form,quantity,ideal_quantity:ideal,unit:form.unit.trim()||"ud",brand:form.brand.trim()||null});await api<PantryItem>(editing?`/api/pantry/items/${editing}`:"/api/pantry/items",{method:editing?"PUT":"POST",body});setOpen(false);setEditing(null);await load()}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el alimento.")}finally{setSaving(false)}};
 return <Screen>
  <PageTitle title="Mi despensa" subtitle="Anota lo que tienes y la cantidad que quieres mantener." right={<Pressable onPress={startAdd} style={{width:46,height:46,borderRadius:16,backgroundColor:c.green,alignItems:"center",justifyContent:"center"}}><Ionicons name="add" size={24} color="white"/></Pressable>}/>
  {error?<Notice tone="error" message={error}/>:null}
  {open?<Card><SectionTitle title={editing?"Editar alimento":"Añadir alimento"}/><Text style={styles.itemMeta}>Usa una unidad base que también usarás en las recetas: latas, rebanadas, g, kg, ml o paquetes.</Text><Field label="Alimento *" placeholder="Ej. Atún" value={form.name} onChangeText={v=>set("name",v)}/><Row><Field label="Marca" placeholder="Opcional" value={form.brand} onChangeText={v=>set("brand",v)}/><Field label="Categoría" placeholder="Alimentos" value={form.category} onChangeText={v=>set("category",v)}/></Row><Row><Field label="Cantidad actual" placeholder="0" keyboardType="decimal-pad" value={form.quantity} onChangeText={v=>set("quantity",v)}/><Field label="Unidad" placeholder="g, lata, rebanada…" value={form.unit} onChangeText={v=>set("unit",v)}/></Row><Field label="Cantidad ideal para tener" placeholder="Opcional" keyboardType="decimal-pad" value={form.ideal_quantity} onChangeText={v=>set("ideal_quantity",v)}/><Text style={styles.itemMeta}>Ejemplos: 6 latas de atún; 500 g de arroz; 20 rebanadas de pan. También puedes registrar un alimento con cantidad 0.</Text><Row><PrimaryButton title={saving?"Guardando…":editing?"Guardar cambios":"Añadir a despensa"} icon="checkmark" onPress={save} disabled={saving}/><PrimaryButton title="Cancelar" secondary onPress={()=>{setOpen(false);setEditing(null);setError("")}}/></Row></Card>:<PrimaryButton title="Añadir alimento" icon="add" onPress={startAdd}/>}
  <SectionTitle title={`${items.length} ${items.length===1?"alimento":"alimentos"}`} action="Actualizar" onAction={()=>void load()}/>
  {loading?<ActivityIndicator color={c.green}/>:items.length?items.map(item=><Card key={item.product_id}><Row><View style={{flex:1}}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{[item.brand,item.category].filter(Boolean).join(" · ")||"Alimento"}</Text></View><Pressable accessibilityRole="button" onPress={()=>startEdit(item)} style={{padding:9}}><Ionicons name="create-outline" size={21} color={c.greenDark}/></Pressable></Row><View style={styles.divider}/><Row style={{justifyContent:"space-between"}}><Text style={styles.itemName}>{item.quantity} {item.unit}</Text><Text style={styles.itemMeta}>{item.ideal_quantity==null?"Sin cantidad ideal":`Ideal: ${item.ideal_quantity} ${item.unit}`}</Text></Row></Card>):<EmptyState title="Todavía no hay alimentos" detail="Añade lo que tienes, incluso con cantidad cero, y define cuánto te gustaría mantener."/>}
 </Screen>
}
