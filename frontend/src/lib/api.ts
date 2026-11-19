import { Platform } from "react-native";
import Constants from "expo-constants";
const webFallback = "http://localhost:8001";
const expoHostUri = Constants.expoConfig?.hostUri;
const expoHost = expoHostUri?.startsWith("[")
  ? expoHostUri.slice(1, expoHostUri.indexOf("]"))
  : expoHostUri?.split(":")[0];
const nativeFallback = expoHost
  ? `http://${expoHost}:8001`
  : Platform.OS === "android"
    ? "http://10.0.2.2:8001"
    : webFallback;
const fallback = Platform.OS === "web" ? webFallback : nativeFallback;
// An explicitly empty URL keeps the browser requests on the current origin
// (used by the Docker web container, where Nginx proxies /api to FastAPI).
// If no value is configured, Expo development keeps its local API fallback.
const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? fallback).replace(/\/$/, "");
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } }); }
  catch { throw new Error("No se pudo conectar con Cesmida. Comprueba que la API está encendida y que la URL es correcta."); }
  if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || `Error de conexión (${response.status})`); }
  return response.json() as Promise<T>;
}
