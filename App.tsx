import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppDrawer from './src/components/AppDrawer';
import ChatScreen from './src/components/ChatScreen';
import { ModelPickerSheet } from './src/components/ModelPickerSheet';
import { SettingsSheet } from './src/components/SettingsSheet';
import { useOnyxStore, useUiStore } from './src/store';
import { ThemeProvider, useTheme } from './src/theme';

/**
 * OnyxAgent — native shell.
 *
 * GestureHandlerRootView → SafeAreaProvider → ThemeProvider → AppDrawer
 * (owns the drawer state + the three native gestures) wrapping the
 * ChatScreen, with the model-picker and settings sheets layered above.
 */
function AppBody() {
  const { colors, scheme } = useTheme();
  const fetchModels = useOnyxStore((s) => s.fetchModels);
  const openModelPicker = useUiStore((s) => s.openModelPicker);

  // Live Pollinations catalogue on boot.
  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  return (
    <View style={[styles.body, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AppDrawer onOpenSettings={() => useUiStore.getState().openSettings()}>
        {(drawer) => <ChatScreen drawer={drawer} onOpenModelPicker={openModelPicker} />}
      </AppDrawer>
      <ModelPickerSheet />
      <SettingsSheet />
    </View>
  );
}

function AppShell() {
  const theme = useOnyxStore((s) => s.settings.theme);
  return (
    <ThemeProvider scheme={theme}>
      <AppBody />
    </ThemeProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  if (!fontsLoaded && !fontError) {
    // Splash-hold until the brand fonts land (the OS splash covers the rest).
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  body: { flex: 1 },
});
