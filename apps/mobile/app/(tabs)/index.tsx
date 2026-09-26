import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { getTelemetry, TelemetryPayload } from '../../services/telemetry';
import { reportTelemetry } from '../../services/reporter';
// iOS components
import {
  LiquidGlassBackground,
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassBadge,
} from '../../components/LiquidGlass';
// Android components
import {
  MD3Background,
  MD3Card,
  MD3Button,
  MD3Badge,
  MD3ListItem,
  MD3SectionHeader,
  MD3Stat,
  MD3Progress,
  MD3,
} from '../../components/AndroidUI';

// ─── Shared Logic Hook ────────────────────────────────────────────────────────
function useDashboard() {
  const [stats, setStats] = useState<TelemetryPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [lastReportedTime, setLastReportedTime] = useState<Date | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'unconfigured' | 'offline'>('checking');
  const [serverUrl, setServerUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const loadStats = async (shouldReport = false) => {
    try {
      const data = await getTelemetry();
      setStats(data);
      const url = (await AsyncStorage.getItem('dashboardUrl')) || '';
      const userId = (await AsyncStorage.getItem('userId')) || '';
      setServerUrl(url);

      if (!url) {
        setServerStatus('unconfigured');
        setStatusMessage('Configure Dashboard URL in Settings');
        return;
      }

      if (shouldReport) {
        setReporting(true);
        try {
          await reportTelemetry(url, userId, data);
          setLastReportedTime(new Date());
          setServerStatus('connected');
          setStatusMessage('Telemetry synced to server');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
          setServerStatus('offline');
          setStatusMessage(e.message || 'Server unreachable');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
          setReporting(false);
        }
      } else {
        try {
          const pingRes = await fetch(`${url.replace(/\/$/, '')}/api/devices`, { method: 'GET' });
          setServerStatus(pingRes.ok ? 'connected' : 'offline');
        } catch {
          setServerStatus('offline');
        }
      }
    } catch (e: any) {
      setStatusMessage(e.message || 'Failed to query sensors');
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => loadStats(false), 8000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    await loadStats(true);
    setRefreshing(false);
  }, []);

  const handleManualReport = () => loadStats(true);

  return { stats, refreshing, reporting, lastReportedTime, serverStatus, serverUrl, statusMessage, onRefresh, handleManualReport };
}

// ─── Android Home Screen ──────────────────────────────────────────────────────
function AndroidHomeScreen() {
  const { stats, refreshing, reporting, lastReportedTime, serverStatus, serverUrl, statusMessage, onRefresh, handleManualReport } = useDashboard();

  if (!stats) {
    return (
      <MD3Background>
        <View style={aStyles.center}>
          <ActivityIndicator size="large" color={MD3.colors.primary} />
          <Text style={aStyles.loadingText}>Reading device telemetry…</Text>
        </View>
      </MD3Background>
    );
  }

  const battColor =
    stats.is_charging ? MD3.colors.info
    : stats.battery_level > 50 ? MD3.colors.success
    : stats.battery_level > 20 ? MD3.colors.warning
    : MD3.colors.error;

  const statusColor =
    serverStatus === 'connected' ? MD3.colors.success
    : serverStatus === 'unconfigured' ? MD3.colors.warning
    : MD3.colors.error;

  const statusLabel =
    serverStatus === 'connected' ? 'Connected'
    : serverStatus === 'unconfigured' ? 'Not configured'
    : 'Offline';

  return (
    <MD3Background>
      <ScrollView
        style={aStyles.scroll}
        contentContainerStyle={aStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[MD3.colors.primary]}
            progressBackgroundColor={MD3.colors.surfaceVariant}
          />
        }
      >
        {/* ── Device Identity Card ─────────────────────── */}
        <MD3Card variant="elevated" accent style={aStyles.deviceCard}>
          <View style={aStyles.deviceCardInner}>
            <View style={aStyles.deviceIconWrap}>
              <Ionicons name="logo-android" size={26} color={MD3.colors.success} />
            </View>
            <View style={aStyles.deviceInfo}>
              <Text style={aStyles.deviceName} numberOfLines={1}>{stats.name}</Text>
              <Text style={aStyles.deviceSub}>
                {stats.model} • Android {Device.osVersion || ''}
              </Text>
              <MD3Badge label="This Android" color={MD3.colors.success} icon="checkmark-circle" />
            </View>
          </View>
          <View style={aStyles.syncRow}>
            <View style={[aStyles.connDot, { backgroundColor: statusColor }]} />
            <Text style={[aStyles.connLabel, { color: statusColor }]}>{statusLabel}</Text>
            <View style={aStyles.syncBtnWrap}>
              <MD3Button
                label={reporting ? 'Syncing…' : 'Sync Now'}
                icon="cloud-upload-outline"
                onPress={handleManualReport}
                loading={reporting}
                variant="filled"
              />
            </View>
          </View>
          {statusMessage !== '' && serverStatus === 'offline' && (
            <View style={aStyles.alertRow}>
              <Ionicons name="warning-outline" size={14} color={MD3.colors.error} />
              <Text style={aStyles.alertText}>{statusMessage}</Text>
            </View>
          )}
        </MD3Card>

        {/* ── Battery Card ──────────────────────────────── */}
        <MD3Card variant="elevated" style={aStyles.batteryCard}>
          <View style={aStyles.batteryHeader}>
            <Text style={aStyles.sectionLabel}>POWER &amp; ENERGY</Text>
            <MD3Badge
              label={stats.is_charging ? 'Charging' : 'On Battery'}
              color={battColor}
              icon={stats.is_charging ? 'flash' : 'battery-half'}
            />
          </View>

          <View style={aStyles.batteryCenter}>
            <MD3Stat
              value={stats.battery_level}
              unit="%"
              label={stats.is_charging ? 'Charging…' : 'Battery remaining'}
              color={battColor}
            />
          </View>

          <View style={aStyles.batteryProgressWrap}>
            <MD3Progress value={stats.battery_level} color={battColor} />
          </View>

          <View style={aStyles.batteryMeta}>
            <View style={aStyles.batteryMetaItem}>
              <Ionicons name="power-outline" size={14} color={MD3.colors.onSurfaceVariant} />
              <Text style={aStyles.batteryMetaLabel}> Source: </Text>
              <Text style={aStyles.batteryMetaValue}>{stats.power_source}</Text>
            </View>
            <View style={aStyles.batteryMetaItem}>
              <Ionicons name="shield-checkmark-outline" size={14} color={MD3.colors.onSurfaceVariant} />
              <Text style={aStyles.batteryMetaLabel}> Health: </Text>
              <Text style={aStyles.batteryMetaValue}>{stats.battery_health}</Text>
            </View>
          </View>
        </MD3Card>

        {/* ── Hardware Card ─────────────────────────────── */}
        <View style={aStyles.sectionWrap}>
          <MD3SectionHeader label="System Hardware" />
          <MD3Card variant="elevated">
            <MD3ListItem
              icon="hardware-chip-outline"
              iconColor={MD3.colors.primary}
              title="Device Model"
              subtitle={stats.model}
            />
            <MD3ListItem
              icon="logo-android"
              iconColor={MD3.colors.success}
              title="Operating System"
              subtitle={`Android ${Device.osVersion || ''}`}
            />
            <MD3ListItem
              icon="shield-checkmark-outline"
              iconColor={MD3.colors.success}
              title="Battery Health"
              subtitle={`${stats.battery_health} Capacity`}
              divider={false}
            />
          </MD3Card>
        </View>

        {/* ── Telemetry Status Card ─────────────────────── */}
        <View style={aStyles.sectionWrap}>
          <MD3SectionHeader label="Telemetry Uplink" />
          <MD3Card variant="elevated">
            <MD3ListItem
              icon="wifi-outline"
              iconColor={statusColor}
              title="Dashboard Server"
              subtitle={serverUrl || 'Not configured — go to Settings'}
              trailing={<MD3Badge label={statusLabel} color={statusColor} />}
            />
            <MD3ListItem
              icon="time-outline"
              iconColor={MD3.colors.onSurfaceVariant}
              title="Last Synced"
              subtitle={
                lastReportedTime
                  ? lastReportedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Awaiting first sync'
              }
              divider={false}
            />
          </MD3Card>
        </View>
      </ScrollView>
    </MD3Background>
  );
}

// ─── iOS Home Screen (unchanged liquid glass) ─────────────────────────────────
function IOSHomeScreen() {
  const { stats, refreshing, reporting, lastReportedTime, serverStatus, serverUrl, statusMessage, onRefresh, handleManualReport } = useDashboard();

  // FIX 7: These were previously hardcoded constants (isIOS = true, isAndroid = false)
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const platformName = `Apple iOS ${Device.osVersion || ''}`.trim();
  const thisDeviceBadge = isIOS ? 'This iPhone' : 'This Device';
  const platformSubtitle = `${stats?.model || 'Device'} • ${isIOS ? 'iOS' : Platform.OS}`;


  if (!stats) {
    return (
      <LiquidGlassBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818cf8" />
          <Text style={styles.loadingText}>Reading iPhone hardware telemetry...</Text>
        </View>
      </LiquidGlassBackground>
    );
  }

  const isLowBattery = stats.battery_level <= 20 && !stats.is_charging;
  const batteryColor = stats.is_charging
    ? '#38bdf8'
    : stats.battery_level > 50
    ? '#34d399'
    : stats.battery_level > 20
    ? '#fbbf24'
    : '#f87171';

  return (
    <LiquidGlassBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#818cf8"
            colors={['#818cf8']}
          />
        }
      >
        <LiquidGlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.deviceIconBadge}>
                <Ionicons name="phone-portrait" size={24} color="#818cf8" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.deviceName} numberOfLines={1}>{stats.name}</Text>
                  <LiquidGlassBadge label={thisDeviceBadge} color="#818cf8" />
                </View>
                <Text style={styles.deviceSubtitle}>{platformSubtitle}</Text>
              </View>
            </View>
            <LiquidGlassButton onPress={handleManualReport} disabled={reporting} style={styles.syncBtn}>
              {reporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="arrow-up-circle" size={16} color="#ffffff" />
                  <Text style={styles.syncBtnText}>Sync Now</Text>
                </>
              )}
            </LiquidGlassButton>
          </View>
        </LiquidGlassCard>

        {statusMessage && serverStatus === 'offline' && (
          <LiquidGlassCard style={styles.alertBanner} intensity={40}>
            <Ionicons name="warning-outline" size={18} color="#f87171" />
            <Text style={styles.alertText}>{statusMessage}</Text>
          </LiquidGlassCard>
        )}

        <LiquidGlassCard style={styles.heroCard} intensity={75}>
          <View style={styles.heroTopRow}>
            <Text style={styles.cardHeaderTitle}>POWER &amp; ENERGY DYNAMICS</Text>
            <LiquidGlassBadge
              label={stats.is_charging ? 'Charging' : 'On Battery'}
              color={batteryColor}
              icon={<Ionicons name={stats.is_charging ? 'flash' : 'battery-charging'} size={12} color={batteryColor} />}
            />
          </View>

          <View style={styles.batteryHeroDisplay}>
            <View style={styles.batteryBigNumberWrapper}>
              <Text style={[styles.batteryPercentNumber, { color: batteryColor }]}>{stats.battery_level}</Text>
              <Text style={styles.batteryPercentSymbol}>%</Text>
            </View>
            <View style={styles.batteryBarTrack}>
              <View style={[styles.batteryBarFill, { width: `${Math.max(4, stats.battery_level)}%`, backgroundColor: batteryColor }]} />
            </View>
            <View style={styles.batteryMetaRow}>
              <Text style={styles.batteryMetaLabel}>Power Source: <Text style={styles.batteryMetaValue}>{stats.power_source}</Text></Text>
              <Text style={styles.batteryMetaLabel}>Capacity: <Text style={styles.batteryMetaValue}>{stats.battery_health}</Text></Text>
            </View>
          </View>

          {isLowBattery && (
            <View style={styles.lowPowerNotice}>
              <Ionicons name="alert-circle" size={15} color="#f87171" />
              <Text style={styles.lowPowerText}>Low Battery: Connect your iPhone to power</Text>
            </View>
          )}
        </LiquidGlassCard>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>SYSTEM HARDWARE SENSORS</Text>
          <LiquidGlassCard style={styles.insetCardGroup} contentStyle={{ padding: 0 }} intensity={70}>
            <View style={styles.insetItem}>
              <View style={styles.itemIconWrap}><Ionicons name="hardware-chip-outline" size={18} color="#818cf8" /></View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>Device Model</Text>
                <Text style={styles.itemValue}>{stats.model}</Text>
              </View>
            </View>
            <View style={styles.separator} />
            <View style={styles.insetItem}>
              <View style={styles.itemIconWrap}><Ionicons name="logo-apple" size={18} color="#c084fc" /></View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>Operating Platform</Text>
                <Text style={styles.itemValue}>{platformName}</Text>
              </View>
            </View>
            <View style={styles.separator} />
            <View style={styles.insetItem}>
              <View style={styles.itemIconWrap}><Ionicons name="shield-checkmark-outline" size={18} color="#34d399" /></View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>Battery Health</Text>
                <Text style={styles.itemValue}>{stats.battery_health} Capacity</Text>
              </View>
            </View>
          </LiquidGlassCard>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>TELEMETRY UPLINK STATUS</Text>
          <LiquidGlassCard style={styles.insetCardGroup} contentStyle={{ padding: 0 }} intensity={70}>
            <View style={styles.insetItem}>
              <View style={[styles.statusDot, { backgroundColor: serverStatus === 'connected' ? '#10b981' : serverStatus === 'unconfigured' ? '#fbbf24' : '#ef4444' }]} />
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>Dashboard Server</Text>
                <Text style={styles.itemValue} numberOfLines={1}>{serverUrl || 'Not configured (Tap Settings)'}</Text>
              </View>
              <LiquidGlassBadge
                label={serverStatus === 'connected' ? 'Connected' : serverStatus === 'unconfigured' ? 'Setup' : 'Offline'}
                color={serverStatus === 'connected' ? '#34d399' : serverStatus === 'unconfigured' ? '#fbbf24' : '#f87171'}
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.insetItem}>
              <View style={styles.itemIconWrap}><Ionicons name="time-outline" size={18} color="#94a3b8" /></View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>Last Telemetry Synced</Text>
                <Text style={styles.itemValue}>
                  {lastReportedTime
                    ? lastReportedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Awaiting first telemetry sync'}
                </Text>
              </View>
            </View>
          </LiquidGlassCard>
        </View>
      </ScrollView>
    </LiquidGlassBackground>
  );
}

// ─── Export: Platform Router ──────────────────────────────────────────────────
export default function HomeScreen() {
  return Platform.OS === 'android' ? <AndroidHomeScreen /> : <IOSHomeScreen />;
}

// ─── Android styles ───────────────────────────────────────────────────────────
const aStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: MD3.colors.onSurfaceVariant, fontSize: 14 },
  // Device card
  deviceCard: { padding: 16 },
  deviceCardInner: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  deviceIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(52,211,153,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 17, fontWeight: '800', color: MD3.colors.onSurface, marginBottom: 3 },
  deviceSub: { fontSize: 12.5, color: MD3.colors.onSurfaceVariant, marginBottom: 8 },
  syncRow: { flexDirection: 'row', alignItems: 'center' },
  connDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connLabel: { fontSize: 12.5, fontWeight: '600', flex: 1 },
  syncBtnWrap: {},
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(248,113,113,0.20)',
  },
  alertText: { color: MD3.colors.error, fontSize: 12, marginLeft: 6, flex: 1 },
  // Battery card
  batteryCard: { padding: 16 },
  batteryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: MD3.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  batteryCenter: { alignItems: 'center', marginBottom: 16 },
  batteryProgressWrap: { marginBottom: 14 },
  batteryMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  batteryMetaItem: { flexDirection: 'row', alignItems: 'center' },
  batteryMetaLabel: { fontSize: 12, color: MD3.colors.onSurfaceVariant },
  batteryMetaValue: { fontSize: 12.5, color: MD3.colors.onSurface, fontWeight: '700' },
  // Section
  sectionWrap: { marginBottom: 4 },
});

// ─── iOS styles (unchanged) ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
  headerCard: { marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceIconBadge: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceName: { fontSize: 16.5, fontWeight: '700', color: '#f8fafc', letterSpacing: 0.2 },
  deviceSubtitle: { fontSize: 12.5, color: '#94a3b8', marginTop: 2 },
  syncBtn: { marginLeft: 10 },
  syncBtnText: { color: '#ffffff', fontSize: 12.5, fontWeight: '700' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)', marginBottom: 14,
  },
  alertText: { color: '#fca5a5', fontSize: 12.5, fontWeight: '600', flex: 1 },
  heroCard: { marginBottom: 18 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardHeaderTitle: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, color: '#94a3b8' },
  batteryHeroDisplay: { alignItems: 'center' },
  batteryBigNumberWrapper: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 14 },
  batteryPercentNumber: { fontSize: 68, fontWeight: '800', letterSpacing: -1.5 },
  batteryPercentSymbol: { fontSize: 26, fontWeight: '700', color: '#94a3b8', marginLeft: 3 },
  batteryBarTrack: {
    width: '100%', height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden', marginBottom: 14,
  },
  batteryBarFill: { height: '100%', borderRadius: 6 },
  batteryMetaRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  batteryMetaLabel: { fontSize: 12, color: '#64748b' },
  batteryMetaValue: { color: '#cbd5e1', fontWeight: '600' },
  lowPowerNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  lowPowerText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  sectionContainer: { marginBottom: 18 },
  sectionHeaderTitle: {
    fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8,
    color: '#64748b', marginBottom: 8, marginLeft: 4,
  },
  insetCardGroup: { borderRadius: 18 },
  insetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  itemIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  itemValue: { fontSize: 14.5, fontWeight: '700', color: '#f8fafc', marginTop: 2 },
  separator: { height: 0.5, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginLeft: 60 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 11 },
});
