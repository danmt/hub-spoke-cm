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
  ConfigService,
  IoService,
  LoggerService,
  RegistryService,
  SecretService,
} from "@hub-spoke/core";

import { MobileIoProvider } from "../providers/MobileIoProvider";
import { MobileLoggerProvider } from "../providers/MobileLoggerProvider";
import { MobileRegistryProvider } from "../providers/MobileRegistryProvider";

import { useColorScheme } from "@/components/useColorScheme";
import { MobileConfigProvider } from "@/providers/MobileConfigProvider";
import { MobileSecretProvider } from "@/providers/MobileSecretProvider";
import { WorkspaceProvider } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { WorkspaceStorage } from "@/services/WorkspaceStorage";

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
        SecretService.setProvider(new MobileSecretProvider());
        ConfigService.setProvider(new MobileConfigProvider());

        // 2. Set Workspace Root (Mobile uses Document Directory)
        const workspaceRoot = Paths.document.uri;

        // 3. Initialize Registry & Logger
        LoggerService.setProvider(new MobileLoggerProvider());
        RegistryService.setProvider(new MobileRegistryProvider(workspaceRoot));

        const activeWorkspace = await WorkspaceStorage.getActiveWorkspace();
        const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);

        await WorkspaceManager.switchWorkspace(activeWorkspace, {
          logger: new MobileLoggerProvider(),
          registry: new MobileRegistryProvider(workspaceDir.uri),
        });

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
    if (loaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isReady]);

  if (!loaded || !isReady) {
    return null;
  }

  return (
    <WorkspaceProvider>
      <RootLayoutNav />
    </WorkspaceProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Step 3: Registration of top-level Action routes */}
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
