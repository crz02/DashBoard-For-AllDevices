import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export function StatusChip({
  label,
  color,
  icon,
}: {
  label: string;
  color: string;
  icon?: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: `${color}22`, borderColor: `${color}66` }]}>
      {icon ? <Ionicons name={icon as any} size={12} color={color} /> : null}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function DetailRow({
  icon,
  iconColor,
  title,
  value,
  trailing,
  last = false,
  style,
}: {
  icon: string;
  iconColor: string;
  title: string;
  value: string;
  trailing?: React.ReactNode;
  last?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.row, style, last && styles.lastRow]}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}1a`, borderColor: `${iconColor}33` }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value} numberOfLines={1}>{value}</Text>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  lastRow: {
    paddingBottom: 16,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  value: {
    marginTop: 2,
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '700',
  },
  trailing: {
    marginLeft: 8,
  },
});
