import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const IS_IOS = Platform.OS === 'ios';
const IS_ANDROID = Platform.OS === 'android';

function AndroidTabBackground() {
  return <View style={styles.androidTabBackground} />;
}

function IOSTabBackground() {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView 
        style={StyleSheet.absoluteFill} 
        effect="regular"
        colorScheme="dark"
      />
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={80} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
      {/* Specular refraction sheen */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.18)',
          'rgba(255, 255, 255, 0.06)',
          'rgba(255, 255, 255, 0.01)',
          'rgba(99, 102, 241, 0.05)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Top specular rim */}
      <View style={styles.topRimLight} pointerEvents="none" />
    </View>
  );
}

function IOSHeaderBackground() {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView 
        style={StyleSheet.absoluteFill} 
        effect="regular"
        colorScheme="dark"
      />
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={80} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
      {/* Specular refraction sheen */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.18)',
          'rgba(255, 255, 255, 0.06)',
          'rgba(255, 255, 255, 0.01)',
          'rgba(99, 102, 241, 0.05)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Bottom specular rim */}
      <View style={styles.bottomRimLight} pointerEvents="none" />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Android: tab bar sits naturally at bottom (not absolute)
  // so content is never hidden behind it.
  // iOS: absolute so blur bleeds through scroll content.
  const tabBarStyle = IS_IOS
    ? {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        height: 86,
        paddingBottom: Math.max(insets.bottom, 20),
        paddingTop: 8,
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        elevation: 0,
      }
    : {
        // Android: normal flow (not absolute) — content is NOT hidden beneath it
        height: 60 + insets.bottom,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        paddingTop: 6,
        backgroundColor: '#0d1121',
        borderTopColor: 'rgba(99, 102, 241, 0.30)',
        borderTopWidth: 1,
        elevation: 12,
      };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: IS_IOS ? -2 : 0,
        },
        tabBarStyle,
        tabBarBackground: () =>
          IS_IOS ? <IOSTabBackground /> : <AndroidTabBackground />,
        headerStyle: {
          backgroundColor: IS_IOS ? 'transparent' : '#0d1121',
          elevation: IS_ANDROID ? 6 : 0,
          shadowOpacity: IS_IOS ? 0 : undefined,
          borderBottomWidth: IS_ANDROID ? 0 : undefined,
        },
        headerBackground: () =>
          IS_IOS ? <IOSHeaderBackground /> : null,
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '700',
          letterSpacing: 0.3,
          color: '#f8fafc',
        },
        headerTintColor: '#818cf8',
        headerShadowVisible: IS_ANDROID,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Statuser Telemetry',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'pulse' : 'pulse-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          headerTitle: 'Connected Fleet',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'hardware-chip' : 'hardware-chip-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Agent Preferences',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'cog' : 'cog-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  androidTabBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d1121',
  },
  topRimLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  bottomRimLight: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
