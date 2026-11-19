import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {api} from '../../src/lib/api';
import {Card,EmptyState,Notice,PageTitle,PrimaryButton,Row,Screen,SectionTitle,ui} from '../../src/components/ui';
import {theme} from '../../src/constants/theme';
import type {ShoppingItem} from '../../src/types';

const c=theme.colors;
export default function ShoppingScreen(){
 const [items,setItems]=useState<ShoppingItem[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [generating,setGenerating]=useState(false);
 async function load(){setLoading(true);try{setItems(await api<ShoppingItem[]>('/api/shopping/items'));setError('')}catch(e){setError(e instanceof Error?e.message:'No se pudo cargar la lista.')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function generate(){setGenerating(true);setError('');try{setItems(await api<ShoppingItem[]>('/api/shopping/generate',{method:'POST',body:JSON.stringify({})}))}catch(e){setError(e instanceof Error?e.message:'No se pudo generar la lista.')}finally{setGenerating(false)}}
 async function toggle(item:ShoppingItem){try{await api(`/api/shopping/items/${item.id}`,{method:'PATCH',body:JSON.stringify({purchased:!item.purchased})});await load()}catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar el producto.')}}
 return <Screen>
  <PageTitle eyebrow="PLAN DE COMPRA" title="Compra" subtitle="Calcula lo que falta comparando tus existencias con las cantidades ideales."/>
  {error?<Notice tone="error" message={error}/>:null}
  <Card><Text style={ui.muted}>La lista se calcula automáticamente: cantidad ideal menos cantidad actual. En Despensa puedes ajustar la cantidad ideal de cada alimento.</Text><PrimaryButton title={generating?'Calculando…':'Generar lista de la compra'} icon="list" onPress={()=>void generate()} disabled={generating}/></Card>
  <SectionTitle title="Lista generada" detail={`${items.filter(x=>!x.purchased).length} pendientes`} action="Actualizar" onAction={()=>void load()}/>
  {loading?<ActivityIndicator color={c.green}/>:items.length===0?<EmptyState title="No hay nada que reponer" detail="Define una cantidad ideal en Despensa y genera la lista cuando quieras."/>:items.map(item=><Card key={item.id}><Row><View style={{flex:1}}><Text style={[ui.itemTitle,item.purchased&&{textDecorationLine:'line-through',color:c.muted}]}>{item.product_name}</Text><Text style={ui.muted}>Comprar {item.quantity} {item.unit}</Text></View><Pressable accessibilityRole="checkbox" accessibilityState={{checked:item.purchased}} onPress={()=>void toggle(item)} style={{padding:8}}><Ionicons name={item.purchased?'checkmark-circle':'ellipse-outline'} size={25} color={item.purchased?c.green:c.muted}/></Pressable></Row></Card>)}
 </Screen>
}
