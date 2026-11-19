import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../src/constants/theme";
export default function RootLayout() { return <SafeAreaProvider><StatusBar style="dark" backgroundColor={theme.colors.canvas} /><Stack screenOptions={{ headerShown:false, contentStyle:{ backgroundColor:theme.colors.canvas } }} /></SafeAreaProvider>; }