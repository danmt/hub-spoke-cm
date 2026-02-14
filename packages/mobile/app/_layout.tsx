import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Paths } from "expo-file-system";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";

// Core Services
import {
  IoService,
  LoggerService,
  RegistryService,
  ValidationService,
} from "@hub-spoke/core";

import { MobileIoProvider } from "../services/MobileIoProvider";
import { MobileLoggerProvider } from "../services/MobileLoggerProvider"; // See note below
import { MobileRegistryProvider } from "../services/MobileRegistryProvider";
import { MobileValidationProvider } from "../services/MobileValidationProvider";

import { useColorScheme } from "@/components/useColorScheme";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function initializeCore() {
      try {
        // 1. Initialize Global Providers
        IoService.setProvider(new MobileIoProvider());
        ValidationService.setProvider(new MobileValidationProvider());

        // 2. Set Workspace Root (Mobile uses Document Directory)
        const workspaceRoot = Paths.document.uri;

        // 3. Initialize Registry & Logger
        LoggerService.setProvider(new MobileLoggerProvider());
        RegistryService.setProvider(new MobileRegistryProvider(workspaceRoot));

        await LoggerService.info("Mobile Hub initialized", { workspaceRoot });

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
    // Hide splash only when fonts AND core logic are ready
    if (loaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isReady]);

  if (!loaded || !isReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </ThemeProvider>
  );
}
