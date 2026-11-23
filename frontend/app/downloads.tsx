import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { BrandHeader, Card, Notice, PageTitle, PrimaryButton, Screen, SectionTitle, styles } from "../src/components/ui";
import { theme } from "../src/constants/theme";

const releasesUrl = "https://github.com/Angelita2006/Cesmida/releases/latest";

export default function DownloadsScreen() {
  const [error, setError] = useState("");

  const openReleases = async () => {
    try {
      await Linking.openURL(releasesUrl);
      setError("");
    } catch {
      setError("No se pudo abrir la página de descargas de GitHub.");
    }
  };

  return (
    <Screen>
      <BrandHeader eyebrow="DESCARGAS" />
      <PageTitle title="Lleva Cesmida contigo." subtitle="Descarga la aplicación para tu dispositivo o úsala desde el navegador." />
      {error ? <Notice tone="error" message={error} /> : null}
      <Card>
        <SectionTitle title="Android" />
        <Text style={styles.itemMeta}>Descarga el archivo APK desde la última versión publicada en GitHub e instálalo en tu dispositivo Android.</Text>
        <PrimaryButton title="Descargar para Android" icon="logo-android" onPress={() => void openReleases()} />
      </Card>
      <Card>
        <SectionTitle title="Escritorio Windows" />
        <Text style={styles.itemMeta}>Descarga el instalador para Windows. Esta versión necesita Docker Desktop para iniciar su API y base de datos local.</Text>
        <PrimaryButton title="Descargar para Windows" icon="desktop-outline" onPress={() => void openReleases()} />
      </Card>
      <Card style={{ backgroundColor: theme.colors.greenSoft }}>
        <SectionTitle title="Web y móvil" />
        <Text style={styles.itemMeta}>La web se puede instalar desde el menú del navegador. En móviles, usa «Añadir a pantalla de inicio» para crear un acceso directo.</Text>
      </Card>
      <Text style={[styles.itemMeta, { textAlign: "center" }]}>Los instaladores estarán disponibles cuando se publique una versión en GitHub Releases.</Text>
    </Screen>
  );
}
