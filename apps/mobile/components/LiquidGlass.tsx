import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  Platform,
  TouchableOpacity,
  Text,
  TextStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';

// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassCard
// iOS  : UIVisualEffectView blur + specular refraction layers
// Android: Multi-stop Material surface + inner corner glow + rim strip
// ─────────────────────────────────────────────────────────────────────────────
interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'systemUltraThinMaterialDark' | 'systemMaterialDark' | 'dark' | 'light' | 'default';
  specular?: boolean;
}

export function LiquidGlassCard({
  children,
  style,
  contentStyle,
  intensity = 65,
  tint = 'systemUltraThinMaterialDark',
  specular = true,
}: LiquidGlassCardProps) {

  // ── Android ──────────────────────────────────────────────────────────────
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.androidCardOuter, style]}>
        {/* Base: deep navy-to-slate surface */}
        <LinearGradient
          colors={['#161b30', '#111626', '#0d1020']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Top-left corner radial glow (indigo) */}
        <View style={styles.androidCornerGlow} pointerEvents="none" />
        {/* Diagonal sheen — simulates light across a curved surface */}
        <LinearGradient
          colors={[
            'rgba(148, 163, 248, 0.11)',
            'rgba(99, 102, 241, 0.05)',
            'transparent',
            'rgba(79, 70, 229, 0.04)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Top rim highlight — crisp 1px specular line */}
        <LinearGradient
          colors={['rgba(200,210,255,0.55)', 'rgba(148,163,248,0.18)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.androidRimTop}
          pointerEvents="none"
        />
        {/* Left rim highlight */}
        <LinearGradient
          colors={['rgba(148,163,248,0.28)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.androidRimLeft}
          pointerEvents="none"
        />
        {/* Content */}
        <View style={[styles.innerContent, contentStyle]}>{children}</View>
      </View>
    );
  }

  // ── iOS — Full Liquid Glass ───────────────────────────────────────────────
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView 
        style={[styles.cardOuter, style]} 
        effect="regular"
        colorScheme="system"
      >
        <View style={[styles.innerContent, contentStyle]}>{children}</View>
      </LiquidGlassView>
    );
  }

  return (
    <View style={[styles.cardOuter, style]}>
      {/* Native UIVisualEffectView */}
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />

      {/* Specular refraction sheen */}
      {specular && (
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
      )}

      {/* Top specular rim */}
      <View style={styles.topRimLight} pointerEvents="none" />

      {/* Content */}
      <View style={[styles.innerContent, contentStyle]}>{children}</View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassButton
// ─────────────────────────────────────────────────────────────────────────────
interface LiquidGlassButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'accent';
}

export function LiquidGlassButton({
  children,
  onPress,
  style,
  disabled = false,
  variant = 'primary',
}: LiquidGlassButtonProps) {
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(
      Platform.OS === 'ios'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );
    onPress();
  };

  const gradientColors = (): string[] => {
    if (variant === 'accent') return ['rgba(129,140,248,0.45)', 'rgba(99,102,241,0.35)', 'rgba(79,70,229,0.25)'];
    if (variant === 'secondary') return ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'];
    return ['#6366f1', '#4f46e5', '#4338ca'];
  };

  if (Platform.OS === 'android') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.78}
        style={[styles.androidBtnOuter, style]}
      >
        <LinearGradient
          colors={disabled ? (['#1e293b', '#162032'] as any) : (gradientColors() as any)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.androidBtnGradient}
        >
          {/* Top rim on button */}
          <View style={styles.androidBtnRim} pointerEvents="none" />
          {children}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.78}
      style={[styles.buttonOuter, style]}
    >
      <LinearGradient
        colors={gradientColors() as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.buttonGradient}
      >
        <View style={styles.buttonRimLight} pointerEvents="none" />
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassBadge
// ─────────────────────────────────────────────────────────────────────────────
interface LiquidGlassBadgeProps {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function LiquidGlassBadge({
  label,
  icon,
  color = '#818cf8',
  style,
  textStyle,
}: LiquidGlassBadgeProps) {
  return (
    <View style={[styles.badgeContainer, { borderColor: `${color}40` }, style]}>
      {Platform.OS === 'ios' && (
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      {Platform.OS === 'android' && (
        // Android badge gets a richer tinted surface
        <LinearGradient
          colors={[`${color}30`, `${color}12`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={[`${color}22`, `${color}08`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {icon}
      <Text style={[styles.badgeText, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassBackground
// ─────────────────────────────────────────────────────────────────────────────
export function LiquidGlassBackground({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'android') {
    return (
      <View style={styles.bgContainer}>
        {/* Deep space base — three-stop radial look via gradient */}
        <LinearGradient
          colors={['#0b0f1f', '#090d1a', '#070913']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Indigo glow — top right */}
        <View style={styles.glowOrbTopRight} pointerEvents="none" />
        {/* Cyan glow — mid left */}
        <View style={styles.glowOrbMidLeft} pointerEvents="none" />
        {/* Purple glow — bottom */}
        <View style={styles.glowOrbBottom} pointerEvents="none" />
        {children}
      </View>
    );
  }

  return (
    <View style={styles.bgContainer}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.glowOrbTopRight} />
        <View style={styles.glowOrbMidLeft} />
        <View style={styles.glowOrbBottom} />
      </View>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Background ─────────────────────────────────────────────────────────────
  bgContainer: {
    flex: 1,
    backgroundColor: '#070a12',
  },
  glowOrbTopRight: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99,102,241,0.20)',
    transform: [{ scaleX: 1.3 }],
  },
  glowOrbMidLeft: {
    position: 'absolute',
    top: 260,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(56,189,248,0.13)',
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: 60,
    right: -30,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(168,85,247,0.13)',
  },

  // ── iOS Card ───────────────────────────────────────────────────────────────
  cardOuter: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderTopColor: 'rgba(255,255,255,0.30)',
    borderLeftColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.50,
    shadowRadius: 20,
    elevation: 8,
  },

  // ── Android Card ───────────────────────────────────────────────────────────
  androidCardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    // Indigo-tinted border
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.22)',
    borderTopColor: 'rgba(148,163,248,0.40)',
    borderLeftColor: 'rgba(129,140,248,0.28)',
    // Material elevation with indigo shadow tint
    elevation: 10,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    marginBottom: 0,
  },
  androidCornerGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99,102,241,0.14)',
  },
  androidRimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  androidRimLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1.5,
    bottom: 0,
  },

  // ── Shared content padding ─────────────────────────────────────────────────
  topRimLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  innerContent: {
    padding: 18,
  },

  // ── iOS Button ─────────────────────────────────────────────────────────────
  buttonOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  buttonRimLight: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },

  // ── Android Button ─────────────────────────────────────────────────────────
  androidBtnOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  androidBtnGradient: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.40)',
  },
  androidBtnRim: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.50)',
  },

  // ── Badge ──────────────────────────────────────────────────────────────────
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
