import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BrandHeader, Card, EmptyState, Notice, PageTitle, PrimaryButton, Row, Screen, SectionTitle, Stat, styles } from "../../src/components/ui";
import { currency, theme } from "../../src/constants/theme";
import { api } from "../../src/lib/api";
import type { DashboardSummary } from "../../src/types";
const c=theme.colors;
const initial:DashboardSummary={pantry_products:0,pantry_units:0,expiring_soon:0,shopping_pending:0,recipes:0,month_income_eur:0,month_expenses_eur:0,month_savings_eur:0};
export default function Dashboard(){
 const [data,setData]=useState(initial);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const router=useRouter();
 const load=async()=>{setLoading(true);try{setData(await api<DashboardSummary>("/api/dashboard"));setError("")}catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el resumen.")}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 return <Screen>
  <BrandHeader/>
  <PageTitle title="Un hogar más ligero." subtitle="Tu despensa, tus recetas y tus gastos en un solo lugar." right={<Pressable onPress={()=>void load()} accessibilityLabel="Actualizar"><Text style={{color:c.green,fontWeight:"800",fontSize:13}}>Actualizar</Text></Pressable>}/>
  {error?<Notice tone="error" message={error}/>:null}
  <Card style={{backgroundColor:c.greenDark,borderColor:c.greenDark,padding:20}}>
   <Text style={{color:"#D5E8D8",fontSize:12,fontWeight:"700",letterSpacing:1}}>ESTE MES</Text>
   <Text style={{color:"white",fontSize:27,fontWeight:"800",marginTop:1}}>Cada compra cuenta.</Text>
   <Text style={{color:"#D5E8D8",fontSize:13,lineHeight:19}}>Revisa lo que tienes antes de comprar y encuentra maneras de aprovecharlo.</Text>
   <Row style={{marginTop:6}}>
    <View style={{flex:1,backgroundColor:"#FFFFFF1A",borderRadius:15,padding:13}}><Text style={{color:"#D5E8D8",fontSize:11}}>Gastos registrados</Text><Text style={{color:"white",fontWeight:"800",fontSize:19,marginTop:4}}>{loading?"···":currency(data.month_expenses_eur)}</Text></View>
    <View style={{flex:1,backgroundColor:"#FFFFFF1A",borderRadius:15,padding:13}}><Text style={{color:"#D5E8D8",fontSize:11}}>Ahorro registrado</Text><Text style={{color:"white",fontWeight:"800",fontSize:19,marginTop:4}}>{loading?"···":currency(data.month_savings_eur)}</Text></View>
   </Row>
  </Card>
  <View style={{gap:10}}><SectionTitle title="Tu casa hoy"/><Row style={{alignItems:"stretch"}}><Stat label="Productos" value={loading?"···":data.pantry_products} icon="leaf-outline"/><Stat label="Por caducar" value={loading?"···":data.expiring_soon} icon="time-outline" tint={c.yellowSoft}/><Stat label="En la compra" value={loading?"···":data.shopping_pending} icon="cart-outline" tint={c.blueSoft}/></Row></View>
  <Card style={{gap:14}}><SectionTitle title="Empieza por aquí"/><Row><View style={{flex:1}}><Text style={styles.itemName}>Añade lo que ya tienes</Text><Text style={styles.itemMeta}>Así la próxima lista aprovecha tu despensa.</Text></View><Text style={{color:c.green,fontSize:24}}>✳</Text></Row><PrimaryButton title="Abrir mi despensa" icon="arrow-forward" onPress={()=>router.push("/(tabs)/pantry")}/><PrimaryButton title="Preparar compra semanal" icon="cart-outline" secondary onPress={()=>router.push("/(tabs)/shopping")}/></Card>
  <View style={{gap:10}}><SectionTitle title="Cocina con intención"/><Card style={{flexDirection:"row",alignItems:"center",gap:14}}><View style={{width:45,height:45,borderRadius:15,backgroundColor:c.coralSoft,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:22}}>🥣</Text></View><View style={{flex:1}}><Text style={styles.itemName}>{loading?"···":data.recipes+" recetas guardadas"}</Text><Text style={styles.itemMeta}>Descubre qué ingredientes usas juntos.</Text></View></Card></View>
  {!loading&&data.pantry_products===0&&!error?<EmptyState title="Tu inventario empieza aquí" detail="Registra hoy unos pocos alimentos y Cesmida empezará a ayudarte a comprar con más cabeza."/>:null}
 </Screen>
}