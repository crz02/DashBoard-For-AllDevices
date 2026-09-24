import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
// iOS
import {
  LiquidGlassBackground,
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassBadge,
} from '../../components/LiquidGlass';
// Android
import {
  MD3Background,
  MD3Card,
  MD3Button,
  MD3Badge,
  MD3Chip,
  MD3Progress,
  MD3,
} from '../../components/AndroidUI';

interface DeviceItem {
  id: string;
  name: string;
  platform: string;
  model: string;
  battery_level: number;
  is_charging: boolean;
  power_source: string;
  last_seen: number;
  is_local?: boolean;
}

// ─── Shared logic ─────────────────────────────────────────────────────────────
function useDevices() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'mac' | 'windows' | 'mobile' | 'online'>('all');

  const loadDevices = async () => {
    try {
      const url = await AsyncStorage.getItem('dashboardUrl');
      const userId = await AsyncStorage.getItem('userId');
      if (!url) {
        setError('Dashboard URL not configured. Set it in Settings.');
        setDevices([]);
        setLoading(false);
        return;
      }
      const fetchUrl = `${url.replace(/\/$/, '')}/api/devices${userId ? `?user_id=${userId}` : ''}`;
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setError('');
      } else {
        setError('Server returned an error status.');
      }
    } catch (e: any) {
      setError(e.message || 'Unable to connect to dashboard server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await loadDevices();
    setRefreshing(false);
  }, []);

  const filteredDevices = useMemo(() => {
    return devices.filter(dev => {
      const p = (dev.platform || '').toLowerCase();
      const nameMatch =
        (dev.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dev.model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.includes(searchQuery.toLowerCase());
      if (!nameMatch) return false;
      const isOnline = Date.now() - (dev.last_seen || 0) * 1000 < 10 * 60 * 1000;
      if (filterPlatform === 'online') return isOnline;
      if (filterPlatform === 'mac') return p.includes('mac') || p.includes('darwin');
      if (filterPlatform === 'windows') return p.includes('win');
      if (filterPlatform === 'mobile') return p.includes('ios') || p.includes('android');
      return true;
    });
  }, [devices, searchQuery, filterPlatform]);

  const getTimeAgo = (timestampSec: number) => {
    if (!timestampSec) return 'Never';
    const elapsed = Math.floor(Date.now() / 1000 - timestampSec);
    if (elapsed < 30) return 'Active now';
    if (elapsed < 60) return `${elapsed}s ago`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    return `${Math.floor(elapsed / 86400)}d ago`;
  };

  const getPlatformMeta = (platformStr: string) => {
    const p = (platformStr || '').toLowerCase();
    if (p.includes('mac') || p.includes('darwin')) return { icon: 'laptop-outline', color: MD3.colors.primary };
    if (p.includes('win')) return { icon: 'desktop-outline', color: MD3.colors.info };
    if (p.includes('ios')) return { icon: 'phone-portrait-outline', color: MD3.colors.purple };
    if (p.includes('android')) return { icon: 'logo-android', color: MD3.colors.success };
    return { icon: 'hardware-chip-outline', color: MD3.colors.onSurfaceVariant };
  };

  return { devices, filteredDevices, refreshing, loading, error, searchQuery, setSearchQuery, filterPlatform, setFilterPlatform, onRefresh, getTimeAgo, getPlatformMeta };
}

// ─── Android Devices Screen ───────────────────────────────────────────────────
function AndroidDevicesScreen() {
  const { filteredDevices, refreshing, loading, error, searchQuery, setSearchQuery, filterPlatform, setFilterPlatform, onRefresh, getTimeAgo, getPlatformMeta } = useDevices();
  const currentDeviceName = Device.deviceName || '';

  const filters: { key: 'all' | 'mac' | 'windows' | 'mobile' | 'online'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: '🟢 Live' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'mac', label: 'Mac' },
    { key: 'windows', label: 'Windows' },
  ];

  const battColor = (item: DeviceItem) =>
    item.is_charging ? MD3.colors.info
    : item.battery_level > 50 ? MD3.colors.success
    : item.battery_level > 20 ? MD3.colors.warning
    : MD3.colors.error;

  return (
    <MD3Background>
      {/* ── Search Bar ─────────────────────────────────── */}
      <View style={aStyles.searchWrap}>
        <View style={aStyles.searchBar}>
          <Ionicons name="search-outline" size={18} color={MD3.colors.onSurfaceVariant} style={aStyles.searchIcon} />
          <TextInput
            style={aStyles.searchInput}
            placeholder="Search devices…"
            placeholderTextColor={MD3.colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={MD3.colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter Chips ────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={aStyles.filterScroll}
        style={aStyles.filterRow}
      >
        {filters.map(f => (
          <MD3Chip
            key={f.key}
            label={f.label}
            active={filterPlatform === f.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilterPlatform(f.key);
            }}
          />
        ))}
      </ScrollView>

      {/* ── Error ───────────────────────────────────────── */}
      {error ? (
        <View style={aStyles.errorWrap}>
          <MD3Card variant="surface">
            <View style={aStyles.errorRow}>
              <Ionicons name="alert-circle-outline" size={20} color={MD3.colors.error} />
              <Text style={aStyles.errorText}>{error}</Text>
            </View>
          </MD3Card>
        </View>
      ) : null}

      {/* ── List ────────────────────────────────────────── */}
      {loading ? (
        <View style={aStyles.center}>
          <ActivityIndicator size="large" color={MD3.colors.primary} />
          <Text style={aStyles.centerText}>Connecting to fleet…</Text>
        </View>
      ) : filteredDevices.length === 0 ? (
        <View style={aStyles.emptyWrap}>
          <View style={aStyles.emptyIcon}>
            <Ionicons name="cloud-offline-outline" size={38} color={MD3.colors.onSurfaceVariant} />
          </View>
          <Text style={aStyles.emptyTitle}>No Devices Found</Text>
          <Text style={aStyles.emptySubtitle}>
            {searchQuery ? 'No devices match your search.' : 'Make sure your devices are running Statuser with the same Dashboard URL.'}
          </Text>
          <MD3Button label="Refresh" icon="refresh" onPress={onRefresh} variant="tonal" style={aStyles.emptyBtn} />
        </View>
      ) : (
        <FlatList
          data={filteredDevices}
          keyExtractor={item => item.id}
          contentContainerStyle={aStyles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[MD3.colors.primary]}
              progressBackgroundColor={MD3.colors.surfaceVariant}
            />
          }
          renderItem={({ item }) => {
            const isOnline = Date.now() - (item.last_seen || 0) * 1000 < 10 * 60 * 1000;
            const isThisDevice = item.name === currentDeviceName || item.is_local;
            const meta = getPlatformMeta(item.platform);
            const bc = battColor(item);

            return (
              <MD3Card
                variant="elevated"
                style={[aStyles.deviceCard, isThisDevice && aStyles.deviceCardSelf]}
              >
                <View style={aStyles.deviceRow}>
                  {/* Platform icon */}
                  <View style={[aStyles.platIconWrap, { backgroundColor: `${meta.color}18` }]}>
                    <Ionicons name={meta.icon as any} size={22} color={meta.color} />
                  </View>

                  {/* Info */}
                  <View style={aStyles.deviceInfoCol}>
                    <View style={aStyles.deviceTitleRow}>
                      <Text style={aStyles.deviceName} numberOfLines={1}>{item.name}</Text>
                      {isThisDevice ? <MD3Badge label="This Device" color={MD3.colors.primary} icon="phone-portrait" /> : null}
                    </View>
                    <Text style={aStyles.deviceModel} numberOfLines={1}>
                      {item.model || item.platform}
                    </Text>
                    <View style={aStyles.statusRow}>
                      <View style={[aStyles.onlineDot, { backgroundColor: isOnline ? MD3.colors.success : '#475569' }]} />
                      <Text style={aStyles.timeAgo}>
                        {isOnline ? 'Online' : 'Offline'} · {getTimeAgo(item.last_seen)}
                      </Text>
                    </View>
                  </View>

                  {/* Battery column */}
                  <View style={aStyles.batteryCol}>
                    <View style={aStyles.batteryTopRow}>
                      <Text style={[aStyles.battPct, { color: bc }]}>
                        {`${item.battery_level}%`}
                      </Text>
                      {item.is_charging ? (
                        <Ionicons name="flash" size={12} color={MD3.colors.info} style={{ marginLeft: 3 }} />
                      ) : null}
                    </View>
                    <View style={aStyles.miniBatTrack}>
                      <View
                        style={[
                          aStyles.miniBatFill,
                          { width: `${Math.max(3, item.battery_level)}%`, backgroundColor: bc },
                        ]}
                      />
                    </View>
                    <Text style={aStyles.powerSource} numberOfLines={1}>
                      {item.is_charging ? 'Charging' : (item.power_source || 'Battery')}
                    </Text>
                  </View>
                </View>
              </MD3Card>
            );
          }}
        />
      )}
    </MD3Background>
  );
}

// ─── iOS Devices Screen (original Liquid Glass) ───────────────────────────────
function IOSDevicesScreen() {
  const { filteredDevices, refreshing, loading, error, searchQuery, setSearchQuery, filterPlatform, setFilterPlatform, onRefresh, getTimeAgo } = useDevices();
  const currentDeviceName = Device.deviceName || '';

  const getPlatformIcon = (platformStr: string) => {
    const p = (platformStr || '').toLowerCase();
    if (p.includes('mac') || p.includes('darwin')) return { name: 'laptop-outline' as const, color: '#818cf8', bg: 'rgba(99, 102, 241, 0.20)' };
    if (p.includes('win')) return { name: 'desktop-outline' as const, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.20)' };
    if (p.includes('ios')) return { name: 'phone-portrait-outline' as const, color: '#c084fc', bg: 'rgba(192, 132, 252, 0.20)' };
    if (p.includes('android')) return { name: 'phone-portrait' as const, color: '#34d399', bg: 'rgba(52, 211, 153, 0.20)' };
    return { name: 'hardware-chip-outline' as const, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.20)' };
  };

  return (
    <LiquidGlassBackground>
      <View style={styles.container}>
        <LiquidGlassCard style={styles.searchCard} contentStyle={{ padding: 0 }} intensity={50}>
          <View style={styles.searchInner}>
            <Ionicons name="search" size={17} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search fleet by name, platform, model..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              autoCapitalize="none"
            />
          </View>
        </LiquidGlassCard>

        <View style={styles.filterChipsRow}>
          {(['all', 'online', 'mac', 'windows', 'mobile'] as const).map((f, i, arr) => {
            const isActive = filterPlatform === f;
            const labels: Record<string, string> = { all: 'All Fleet', online: '🟢 Online', mac: 'Mac', windows: 'Windows', mobile: 'Mobile' };
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, isActive && styles.filterChipActive, i < arr.length - 1 && { marginRight: 7 }]}
                onPress={() => { Haptics.selectionAsync(); setFilterPlatform(f); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{labels[f]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? (
          <LiquidGlassCard style={styles.errorCard} intensity={40}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={18} color="#f87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </LiquidGlassCard>
        ) : null}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#818cf8" />
            <Text style={styles.centerText}>Connecting to fleet telemetry...</Text>
          </View>
        ) : filteredDevices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cloud-offline-outline" size={36} color="#64748b" />
            </View>
            <Text style={styles.emptyTitle}>No Devices Reported</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No devices match your filter query.' : 'Make sure your devices are running Statuser with the same Dashboard URL.'}
            </Text>
            <LiquidGlassButton onPress={onRefresh} style={{ marginTop: 10 }}>
              <Ionicons name="refresh" size={16} color="#ffffff" />
              <Text style={styles.emptyBtnText}>Refresh Devices</Text>
            </LiquidGlassButton>
          </View>
        ) : (
          <FlatList
            data={filteredDevices}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" colors={['#818cf8']} />}
            renderItem={({ item }) => {
              const isOnline = Date.now() - (item.last_seen || 0) * 1000 < 10 * 60 * 1000;
              const isThisPhone = item.name === currentDeviceName || item.is_local;
              const iconInfo = getPlatformIcon(item.platform);
              const battColor = item.is_charging ? '#38bdf8' : item.battery_level > 50 ? '#34d399' : item.battery_level > 20 ? '#fbbf24' : '#f87171';
              return (
                <LiquidGlassCard style={[styles.deviceCard, isThisPhone && styles.deviceCardThisPhone]} intensity={65}>
                  <View style={styles.deviceRow}>
                    <View style={[styles.platformIconWrap, { backgroundColor: iconInfo.bg }]}>
                      <Ionicons name={iconInfo.name} size={22} color={iconInfo.color} />
                    </View>
                    <View style={styles.deviceInfoCol}>
                      <View style={styles.deviceTitleRow}>
                        <Text style={styles.deviceNameText} numberOfLines={1}>{item.name}</Text>
                        {isThisPhone && <LiquidGlassBadge label="This Phone" color="#818cf8" />}
                      </View>
                      <Text style={styles.deviceModelText} numberOfLines={1}>{item.model || item.platform}</Text>
                      <View style={styles.statusRow}>
                        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10b981' : '#64748b' }]} />
                        <Text style={styles.timeAgoText}>{isOnline ? 'Online' : 'Offline'} • {getTimeAgo(item.last_seen)}</Text>
                      </View>
                    </View>
                    <View style={styles.batteryCol}>
                      <View style={styles.batteryValueRow}>
                        <Text style={[styles.batteryNumber, { color: battColor }]}>{item.battery_level}%</Text>
                        {item.is_charging && <Ionicons name="flash" size={13} color="#38bdf8" style={{ marginLeft: 3 }} />}
                      </View>
                      <View style={styles.miniBarTrack}>
                        <View style={[styles.miniBarFill, { width: `${Math.max(4, item.battery_level)}%`, backgroundColor: battColor }]} />
                      </View>
                      <Text style={styles.powerSourceText} numberOfLines={1}>{item.is_charging ? 'Charging' : item.power_source}</Text>
                    </View>
                  </View>
                </LiquidGlassCard>
              );
            }}
          />
        )}
      </View>
    </LiquidGlassBackground>
  );
}

// ─── Export: Platform Router ──────────────────────────────────────────────────
export default function DevicesScreen() {
  return Platform.OS === 'android' ? <AndroidDevicesScreen /> : <IOSDevicesScreen />;
}

// ─── Android styles ───────────────────────────────────────────────────────────
const aStyles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MD3.colors.surfaceVariant,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: MD3.colors.outlineVariant,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: MD3.colors.onSurface },
  filterRow: { maxHeight: 50 },
  filterScroll: { paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center' },
  errorWrap: { paddingHorizontal: 16 },
  errorRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  errorText: { color: MD3.colors.error, fontSize: 13, marginLeft: 8, flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  centerText: { color: MD3.colors.onSurfaceVariant, fontSize: 14 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: MD3.colors.surfaceVariant,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: MD3.colors.onSurface, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: MD3.colors.onSurfaceVariant, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  emptyBtn: {},
  listContent: { padding: 16, paddingBottom: 24 },
  deviceCard: { marginBottom: 0 },
  deviceCardSelf: { borderColor: `${MD3.colors.primary}44`, borderTopColor: MD3.colors.primary },
  deviceRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  platIconWrap: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  deviceInfoCol: { flex: 1 },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  deviceName: { fontSize: 15.5, fontWeight: '700', color: MD3.colors.onSurface, marginRight: 6, flexShrink: 1 },
  deviceModel: { fontSize: 12, color: MD3.colors.onSurfaceVariant, marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  timeAgo: { fontSize: 11, color: MD3.colors.onSurfaceVariant },
  batteryCol: { alignItems: 'flex-end', width: 72, marginLeft: 8 },
  batteryTopRow: { flexDirection: 'row', alignItems: 'center' },
  battPct: { fontSize: 18, fontWeight: '800' },
  miniBatTrack: { width: 56, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginVertical: 4 },
  miniBatFill: { height: '100%', borderRadius: 3 },
  powerSource: { fontSize: 10.5, color: MD3.colors.onSurfaceVariant },
});

// ─── iOS styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  searchCard: { borderRadius: 16, marginBottom: 12 },
  searchInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#f8fafc', fontSize: 14.5 },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'nowrap', marginBottom: 14 },
  filterChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterChipActive: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  filterChipTextActive: { color: '#ffffff', fontWeight: '700' },
  listContent: { paddingBottom: 110 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  centerText: { color: '#94a3b8', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
  emptyBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  errorCard: { marginBottom: 12, backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: '#fca5a5', fontSize: 12.5, fontWeight: '600', flex: 1 },
  deviceCard: { marginBottom: 10, borderRadius: 18 },
  deviceCardThisPhone: { borderColor: 'rgba(129,140,248,0.5)', borderLeftWidth: 3, borderLeftColor: '#818cf8' },
  deviceRow: { flexDirection: 'row', alignItems: 'center' },
  platformIconWrap: { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  deviceInfoCol: { flex: 1 },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceNameText: { fontSize: 15.5, fontWeight: '700', color: '#f8fafc' },
  deviceModelText: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  timeAgoText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  batteryCol: { alignItems: 'flex-end', width: 76 },
  batteryValueRow: { flexDirection: 'row', alignItems: 'center' },
  batteryNumber: { fontSize: 18, fontWeight: '800' },
  miniBarTrack: { width: 58, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginVertical: 4 },
  miniBarFill: { height: '100%', borderRadius: 3 },
  powerSourceText: { fontSize: 10.5, color: '#64748b', fontWeight: '500' },
});
