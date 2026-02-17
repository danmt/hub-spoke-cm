import { useColorScheme } from "@/components/useColorScheme";
import { MobileConfigProvider } from "@/providers/MobileConfigProvider";
import { MobileSecretProvider } from "@/providers/MobileSecretProvider";
import { AgentsProvider } from "@/services/AgentsContext";
import { HubsProvider } from "@/services/HubsContext";
import { WorkspaceProvider } from "@/services/WorkspaceContext";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  ConfigService,
  IoService,
  LoggerService,
  SecretService,
} from "@hub-spoke/core";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import "react-native-reanimated";
import { MobileIoProvider } from "../providers/MobileIoProvider";
import { MobileLoggerProvider } from "../providers/MobileLoggerProvider";
export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const [isReady, setIsReady] = useState(false);

  async function onFetchUpdateAsync() {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update Available",
          "A new version of Hub Spoke is available. Restart now to apply?",
          [
            { text: "Later", style: "cancel" },
            { text: "Restart", onPress: () => Updates.reloadAsync() },
          ],
        );
      }
    } catch (error) {
      await LoggerService.error(`OTA Update Error: ${error}`);
    }
  }

  useEffect(() => {
    async function initializeCore() {
      try {
        if (!__DEV__) {
          await onFetchUpdateAsync();
        }

        IoService.setProvider(new MobileIoProvider());
        SecretService.setProvider(new MobileSecretProvider());
        ConfigService.setProvider(new MobileConfigProvider());
        LoggerService.setProvider(new MobileLoggerProvider());

        await LoggerService.info("Mobile Hub initialized");

        setIsReady(true);
      } catch (e) {
        console.error("Failed to initialize Hub & Spoke Core", e);
      }
    }

    initializeCore();
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isReady]);

  if (!loaded || !isReady) {
    return null;
  }

  return (
    <WorkspaceProvider>
      <HubsProvider>
        <AgentsProvider>
          <RootLayoutNav />
        </AgentsProvider>
      </HubsProvider>
    </WorkspaceProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="hubs/new"
          options={{
            presentation: "fullScreenModal",
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="hubs/fill"
          options={{
            presentation: "fullScreenModal",
            headerShown: false,
            gestureEnabled: false,
          }}
        />

        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </ThemeProvider>
  );
}
