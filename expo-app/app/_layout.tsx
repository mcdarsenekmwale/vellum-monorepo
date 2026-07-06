import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SocialProvider } from "@/lib/social-store";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <SocialProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTitleStyle: { color: colors.foreground, fontWeight: "600" },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="article/[slug]" options={{ title: "" }} />
            <Stack.Screen name="author/[id]" options={{ title: "" }} />
            <Stack.Screen name="category/[name]" options={{ title: "" }} />
            <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
            <Stack.Screen name="compose" options={{ title: "New story", presentation: "modal" }} />
          </Stack>
        </SocialProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
