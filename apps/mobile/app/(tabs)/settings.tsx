import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { registerBackgroundFetchAsync, unregisterBackgroundFetchAsync } from '../../services/background';
import {
  LiquidGlassBackground,
  LiquidGlassCard,
  LiquidGlassButton,
} from '../../components/LiquidGlass';

export default function SettingsScreen() {
  const [config, setConfig] = useState({
    dashboardUrl: '',
    userId: '',
    deviceId: '',
    autoStart: false,
    intervalMin: '5',
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; pingMs?: number } | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const dashboardUrl = (await AsyncStorage.getItem('dashboardUrl')) || '';
      const userId = (await AsyncStorage.getItem('userId')) || '';
      const deviceId = (await AsyncStorage.getItem('deviceId')) || '';
      const autoStart = (await AsyncStorage.getItem('autoStart')) === 'true';
      const intervalMin = (await AsyncStorage.getItem('intervalMin')) || '5';

      setConfig({ dashboardUrl, userId, deviceId, autoStart, intervalMin });
    };
    loadConfig();
  }, []);

  const saveConfig = async (key: string, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    await AsyncStorage.setItem(key, String(value));

    if (key === 'autoStart' || key === 'intervalMin') {
      const isEnabled = key === 'autoStart' ? value : config.autoStart;
      const interval = parseInt(key === 'intervalMin' ? String(value) : config.intervalMin, 10) || 5;

      if (isEnabled) {
        await registerBackgroundFetchAsync(interval);
      } else {
        await unregisterBackgroundFetchAsync();
      }
    }
  };

  const handleTestConnection = async () => {
    if (!config.dashboardUrl) {
      setTestResult({ success: false, message: 'Please enter a server URL first' });
      return;
    }

    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTesting(true);
    setTestResult(null);

    const start = Date.now();
    try {
      const cleanUrl = config.dashboardUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/devices${config.userId ? `?user_id=${config.userId}` : ''}`, {
        method: 'GET',
        headers: config.userId ? { 'X-User-Id': config.userId } : {},
      });
      const pingMs = Date.now() - start;

      if (res.ok) {
        setTestResult({ success: true, message: `Connected to server! (${pingMs}ms latency)`, pingMs });
        if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setTestResult({ success: false, message: `Server replied with HTTP ${res.status}` });
        if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: `Connection failed: ${e.message || 'Host unreachable'}` });
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setTesting(false);
    }
  };

  const handleApplyLocalMacPreset = () => {
    const localMacUrl = 'http://192.168.29.20:8080';
    saveConfig('dashboardUrl', localMacUrl);
    if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <LiquidGlassBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* SECTION 1: SERVER CONNECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>SERVER CONNECTION</Text>

          <LiquidGlassCard style={styles.insetCardGroup} contentStyle={{ padding: 0 }} intensity={70}>
            <View style={styles.inputItem}>
              <View style={[styles.iconBadge, { backgroundColor: '#6366f1' }]}>
                <Ionicons name="globe-outline" size={17} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Dashboard URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={config.dashboardUrl}
                  onChangeText={text => saveConfig('dashboardUrl', text)}
                  placeholder="http://192.168.29.20:8080"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.inputItem}>
              <View style={[styles.iconBadge, { backgroundColor: '#38bdf8' }]}>
                <Ionicons name="person-outline" size={17} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>User ID (Scope)</Text>
                <TextInput
                  style={styles.textInput}
                  value={config.userId}
                  onChangeText={text => saveConfig('userId', text)}
                  placeholder="default"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </LiquidGlassCard>

          {/* Quick Helper Preset */}
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetPill} onPress={handleApplyLocalMacPreset} activeOpacity={0.7}>
              <Ionicons name="laptop-outline" size={14} color="#818cf8" />
              <Text style={styles.presetPillText}>Use Local Mac (192.168.29.20:8080)</Text>
            </TouchableOpacity>
          </View>

          {/* Test Connection Button & Result */}
          <LiquidGlassButton
            variant="accent"
            onPress={handleTestConnection}
            disabled={testing}
            style={{ marginTop: 10 }}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="flash-outline" size={16} color="#ffffff" />
                <Text style={styles.testBtnText}>Test Server Connection</Text>
              </>
            )}
          </LiquidGlassButton>

          {testResult && (
            <LiquidGlassCard
              style={[
                styles.testResultBox,
                {
                  backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                  borderColor: testResult.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
                },
              ]}
              intensity={40}
            >
              <View style={styles.testResultInner}>
                <Ionicons
                  name={testResult.success ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={testResult.success ? '#34d399' : '#f87171'}
                />
                <Text style={[styles.testResultText, { color: testResult.success ? '#34d399' : '#f87171' }]}>
                  {testResult.message}
                </Text>
              </View>
            </LiquidGlassCard>
          )}
        </View>

        {/* SECTION 2: BACKGROUND TELEMETRY */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>BACKGROUND TELEMETRY</Text>

          <LiquidGlassCard style={styles.insetCardGroup} contentStyle={{ padding: 0 }} intensity={70}>
            <View style={styles.switchItem}>
              <View style={[styles.iconBadge, { backgroundColor: '#10b981' }]}>
                <Ionicons name="sync-outline" size={17} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemMainTitle}>Background Sync</Text>
                <Text style={styles.itemSubtitle}>Report telemetry even when closed</Text>
              </View>
              <Switch
                value={config.autoStart}
                onValueChange={val => {
                  if (Platform.OS === 'ios') Haptics.selectionAsync();
                  saveConfig('autoStart', val);
                }}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#6366f1' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.intervalItem}>
              <Text style={styles.intervalTitle}>Frequency</Text>
              <View style={styles.frequencyRow}>
                {['1', '5', '15', '30'].map(val => {
                  const isActive = config.intervalMin === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.freqChip, isActive && styles.freqChipActive]}
                      onPress={() => {
                        if (Platform.OS === 'ios') Haptics.selectionAsync();
                        saveConfig('intervalMin', val);
                      }}
                    >
                      <Text style={[styles.freqChipText, isActive && styles.freqChipTextActive]}>
                        {val}m
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </LiquidGlassCard>

          <Text style={styles.sectionFooterNote}>
            {Platform.OS === 'ios'
              ? 'iOS Background Fetch runs opportunistically when your iPhone is connected to Wi-Fi and power.'
              : 'Android WorkManager runs background telemetry sync periodically based on system optimization settings.'}
          </Text>
        </View>

        {/* SECTION 3: DEVICE IDENTITY OVERRIDE */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>DEVICE IDENTIFIER</Text>

          <LiquidGlassCard style={styles.insetCardGroup} contentStyle={{ padding: 0 }} intensity={70}>
            <View style={styles.inputItem}>
              <View style={[styles.iconBadge, { backgroundColor: '#a855f7' }]}>
                <Ionicons name="finger-print-outline" size={17} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Device ID Override</Text>
                <TextInput
                  style={styles.textInput}
                  value={config.deviceId}
                  onChangeText={text => saveConfig('deviceId', text)}
                  placeholder="Leave blank for auto-detected ID"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </LiquidGlassCard>
        </View>

        {/* SECTION 4: DIAGNOSTICS */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>SYSTEM & BUILD DIAGNOSTICS</Text>

          <LiquidGlassCard style={styles.insetCardGroup} contentStyle={{ padding: 0 }} intensity={70}>
            <View style={styles.diagnosticRow}>
              <Text style={styles.diagLabel}>Device Model</Text>
              <Text style={styles.diagValue}>{Device.modelName || (Platform.OS === 'ios' ? 'iPhone' : 'Android Device')}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.diagnosticRow}>
              <Text style={styles.diagLabel}>Operating System</Text>
              <Text style={styles.diagValue}>{Device.osName} {Device.osVersion}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.diagnosticRow}>
              <Text style={styles.diagLabel}>Statuser Agent</Text>
              <Text style={styles.diagValue}>v1.0.0 (Liquid Glass)</Text>
            </View>
          </LiquidGlassCard>
        </View>
      </ScrollView>
    </LiquidGlassBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 110 : 24,
  },
  sectionContainer: {
    marginBottom: 22,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#64748b',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionFooterNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 16,
  },
  insetCardGroup: {
    borderRadius: 18,
  },
  inputItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  intervalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  textInput: {
    color: '#f8fafc',
    fontSize: 15,
    marginTop: 2,
    paddingVertical: 2,
  },
  itemMainTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  itemSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  intervalTitle: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '600',
    marginLeft: 42,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  freqChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  freqChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  freqChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  freqChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  separator: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 56,
  },
  presetRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginLeft: 4,
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  presetPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#c7d2fe',
  },
  testBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  testResultBox: {
    marginTop: 10,
    borderRadius: 14,
  },
  testResultInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testResultText: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  diagLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  diagValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
});
