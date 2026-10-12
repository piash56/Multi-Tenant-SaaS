import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ApiClient } from "@saas/api-client";
import type { ServiceHealth } from "@saas/shared-types";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

type RootStackParams = { Home: undefined; Status: undefined };
const Stack = createNativeStackNavigator<RootStackParams>();

function HomeScreen({ navigation }: { navigation: { navigate: (screen: "Status") => void } }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Milestone 2 foundation</Text>
        <Text style={styles.title}>Unified Inbox</Text>
        <Text style={styles.copy}>
          A shared, typed mobile client foundation. No business data is stored here.
        </Text>
        <Button title="Check API liveness" onPress={() => navigation.navigate("Status")} />
      </View>
    </SafeAreaView>
  );
}

function StatusScreen() {
  const client = useMemo(
    () => new ApiClient({ baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3001" }),
    [],
  );
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client
      .getLiveness()
      .then(setHealth)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to reach API");
      });
  }, [client]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>API status</Text>
        <Text style={styles.copy}>
          {error ?? (health ? `API is ${health.status}` : "Checking…")}
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Status" component={StatusScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7fb", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "white", borderRadius: 18, padding: 24, gap: 14 },
  eyebrow: { color: "#3157d5", fontWeight: "700", textTransform: "uppercase" },
  title: { color: "#14213d", fontSize: 36, fontWeight: "800" },
  copy: { color: "#506078", fontSize: 17, lineHeight: 25 },
});
