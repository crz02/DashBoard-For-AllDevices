/**
 * AndroidUI.tsx
 * Complete Android Material Design 3 component library.
 * Dark theme with indigo accent, proper elevation, and Material surfaces.
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  TextStyle,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Design Tokens ───────────────────────────────────────────────────────────
export const MD3 = {
  colors: {
    background: '#0d0618',
    surface: '#0f1228',
    surfaceVariant: '#161b32',
    surfaceHigh: '#1d2240',
    primary: '#818cf8',
    primaryDim: '#070520ff',
    onPrimary: '#ffffff',
    onSurface: '#e8eaf6',
    onSurfaceVariant: '#94a3b8',
    outline: 'rgba(129,140,248,0.20)',
    outlineVariant: 'rgba(255,255,255,0.07)',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#38bdf8',
    purple: '#c084fc',
  },
};

// ─── MD3 Surface Card ─────────────────────────────────────────────────────────
interface MD3CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'surface' | 'elevated' | 'filled';
  accent?: boolean;
}

export function MD3Card({ children, style, variant = 'elevated', accent = false }: MD3CardProps) {
  const bgColor =
    variant === 'filled'
      ? MD3.colors.surfaceHigh
      : variant === 'elevated'
      ? MD3.colors.surface
      : MD3.colors.surfaceVariant;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bgColor },
        accent && styles.cardAccent,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── MD3 Button ───────────────────────────────────────────────────────────────
interface MD3ButtonProps {
  label: string;
  onPress: () => void;
  icon?: string;
  variant?: 'filled' | 'tonal' | 'outlined';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MD3Button({
  label,
  onPress,
  icon,
  variant = 'filled',
  loading = false,
  disabled = false,
  style,
}: MD3ButtonProps) {
  if (variant === 'filled') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.82}
        style={[styles.btnOuter, style]}
      >
        <LinearGradient
          colors={disabled ? ['#334155', '#1e293b'] : ['#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btnFilled}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              {icon && <Ionicons name={icon as any} size={16} color="#ffffff" style={{ marginRight: 6 }} />}
              <Text style={styles.btnFilledText}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'tonal') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.82}
        style={[styles.btnOuter, styles.btnTonal, style]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={MD3.colors.primary} />
        ) : (
          <>
            {icon && <Ionicons name={icon as any} size={16} color={MD3.colors.primary} style={{ marginRight: 6 }} />}
            <Text style={styles.btnTonalText}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[styles.btnOuter, styles.btnOutlined, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={MD3.colors.primary} />
      ) : (
        <>
          {icon && <Ionicons name={icon as any} size={16} color={MD3.colors.primary} style={{ marginRight: 6 }} />}
          <Text style={styles.btnOutlinedText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── MD3 Badge ────────────────────────────────────────────────────────────────
interface MD3BadgeProps {
  label: string;
  color?: string;
  icon?: string;
}

export function MD3Badge({ label, color = MD3.colors.primary, icon }: MD3BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
      {icon && <Ionicons name={icon as any} size={11} color={color} style={{ marginRight: 4 }} />}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── MD3 List Item ────────────────────────────────────────────────────────────
interface MD3ListItemProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  divider?: boolean;
}

export function MD3ListItem({
  icon,
  iconColor = MD3.colors.primary,
  title,
  subtitle,
  trailing,
  divider = true,
}: MD3ListItemProps) {
  return (
    <>
      <View style={styles.listItem}>
        <View style={[styles.listIconWrap, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={icon as any} size={19} color={iconColor} />
        </View>
        <View style={styles.listContent}>
          <Text style={styles.listTitle}>{title}</Text>
          {subtitle !== undefined && (
            <Text style={styles.listSubtitle} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        {trailing && <View style={styles.listTrailing}>{trailing}</View>}
      </View>
      {divider && <View style={styles.listDivider} />}
    </>
  );
}

// ─── MD3 Chip ─────────────────────────────────────────────────────────────────
interface MD3ChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
}

export function MD3Chip({ label, active = false, onPress }: MD3ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── MD3 Screen Background ────────────────────────────────────────────────────
export function MD3Background({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bg}>
      {/* ── Layer 1: Deep purple-to-midnight base ── */}
      <LinearGradient
        colors={['#160a2e', '#0d0618', '#060310']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* ── Layer 2: Vivid indigo-violet diagonal sweep ── */}
      <LinearGradient
        colors={[
          'rgba(99,102,241,0.45)',
          'rgba(139,92,246,0.25)',
          'transparent',
          'rgba(168,85,247,0.18)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* ── Glow orb — bright indigo top-right ── */}
      <View style={styles.orbIndigo} pointerEvents="none" />
      {/* ── Glow orb — violet top-left ── */}
      <View style={styles.orbViolet} pointerEvents="none" />
      {/* ── Glow orb — rose/magenta mid-right ── */}
      <View style={styles.orbCyan} pointerEvents="none" />
      {/* ── Glow orb — deep purple bottom ── */}
      <View style={styles.orbPurple} pointerEvents="none" />
      {/* ── Layer 3: Top purple radial bloom ── */}
      <LinearGradient
        colors={['rgba(139,92,246,0.30)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* ── Layer 4: Bottom vignette ── */}
      <LinearGradient
        colors={['transparent', 'rgba(6,2,16,0.85)']}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

// ─── MD3 Section Header ───────────────────────────────────────────────────────
export function MD3SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

// ─── MD3 Stat Block ───────────────────────────────────────────────────────────
interface MD3StatProps {
  value: string | number;
  unit?: string;
  label: string;
  color?: string;
}

export function MD3Stat({ value, unit, label, color = MD3.colors.primary }: MD3StatProps) {
  return (
    <View style={styles.statBlock}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── MD3 Progress Bar ────────────────────────────────────────────────────────
interface MD3ProgressProps {
  value: number; // 0–100
  color?: string;
}

export function MD3Progress({ value, color = MD3.colors.primary }: MD3ProgressProps) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Card
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  cardAccent: {
    borderColor: 'rgba(99,102,241,0.28)',
    borderTopColor: 'rgba(129,140,248,0.42)',
  },
  // Buttons
  btnOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  btnFilled: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 42,
  },
  btnFilledText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnTonal: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.30)',
    minHeight: 42,
  },
  btnTonalText: {
    color: MD3.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  btnOutlined: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: MD3.colors.primary,
    minHeight: 42,
  },
  btnOutlinedText: {
    color: MD3.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // List
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  listIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 13.5,
    color: MD3.colors.onSurfaceVariant,
    fontWeight: '500',
    marginBottom: 2,
  },
  listSubtitle: {
    fontSize: 15,
    color: MD3.colors.onSurface,
    fontWeight: '700',
  },
  listTrailing: {
    marginLeft: 10,
  },
  listDivider: {
    height: 1,
    backgroundColor: MD3.colors.outlineVariant,
    marginLeft: 68,
  },
  // Chip
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: MD3.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: MD3.colors.outlineVariant,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: MD3.colors.primaryDim,
    borderColor: MD3.colors.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: MD3.colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  // Background
  bg: {
    flex: 1,
    backgroundColor: '#0d0618',
  },
  // Glow orbs — vivid, high opacity, large scale
  orbIndigo: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: SCREEN_W * 0.85,
    height: SCREEN_W * 0.85,
    borderRadius: SCREEN_W * 0.425,
    backgroundColor: 'rgba(99,102,241,0.42)',
    transform: [{ scaleX: 1.5 }],
  },
  orbViolet: {
    position: 'absolute',
    top: 60,
    left: -100,
    width: SCREEN_W * 0.65,
    height: SCREEN_W * 0.65,
    borderRadius: SCREEN_W * 0.325,
    backgroundColor: 'rgba(139,92,246,0.35)',
  },
  orbCyan: {
    position: 'absolute',
    top: SCREEN_H * 0.38,
    right: -60,
    width: SCREEN_W * 0.65,
    height: SCREEN_W * 0.65,
    borderRadius: SCREEN_W * 0.325,
    backgroundColor: 'rgba(236,72,153,0.22)',
  },
  orbPurple: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: SCREEN_W * 0.80,
    height: SCREEN_W * 0.80,
    borderRadius: SCREEN_W * 0.40,
    backgroundColor: 'rgba(168,85,247,0.30)',
    transform: [{ scaleX: 1.2 }],
  },
  // Section header
  sectionHeader: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    paddingTop: 4,
  },
  sectionHeaderText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: MD3.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  // Stat
  statBlock: {
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statUnit: {
    fontSize: 22,
    fontWeight: '700',
    color: MD3.colors.onSurfaceVariant,
    marginLeft: 2,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: MD3.colors.onSurfaceVariant,
    fontWeight: '500',
    marginTop: 2,
  },
  // Progress
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
});
