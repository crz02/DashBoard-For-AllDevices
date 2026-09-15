import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTelemetry, TelemetryPayload } from '../../services/telemetry';
import { reportTelemetry } from '../../services/reporter';

export default function HomeScreen() {
  const [stats, setStats] = useState<TelemetryPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStats = async (report = false) => {
    try {
      const data = await getTelemetry();
      setStats(data);
      
      if (report) {
        const url = await AsyncStorage.getItem('dashboardUrl');
        const userId = await AsyncStorage.getItem('userId');
        if (url) {
          await reportTelemetry(url, userId, data);
        } else {
          setError('Configure Dashboard URL in settings to report');
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => loadStats(), 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setError('');
    await loadStats(true);
    setRefreshing(false);
  }, []);

  if (!stats) return <View style={styles.container}><Text style={styles.text}>Loading...</Text></View>;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f0f6fc" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{stats.name}</Text>
        <TouchableOpacity style={styles.btn} onPress={onRefresh}>
          <Text style={styles.btnText}>Report Now</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#f85149' }]}>
          <Text style={{ color: '#f85149' }}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { alignItems: 'center', paddingVertical: 40 }]}>
        <Text style={[styles.batteryText, { color: stats.battery_level < 20 && !stats.is_charging ? '#f85149' : '#2ea043' }]}>
          {stats.battery_level}%
        </Text>
        <Text style={styles.subtitle}>
          {stats.is_charging ? '⚡ Charging' : stats.power_source}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridCard}>
          <Text style={styles.label}>Battery Health</Text>
          <Text style={styles.value}>{stats.battery_health}</Text>
        </View>
        <View style={styles.gridCard}>
          <Text style={styles.label}>Platform</Text>
          <Text style={styles.value}>{stats.platform}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f0f6fc' },
  btn: { backgroundColor: '#1f6feb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  btnText: { color: '#fff', fontWeight: '500' },
  card: { backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1, borderRadius: 8, padding: 20, marginBottom: 16 },
  batteryText: { fontSize: 64, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#8b949e', marginTop: 8 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridCard: { backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1, borderRadius: 8, padding: 16, width: '48%' },
  label: { fontSize: 12, color: '#8b949e', textTransform: 'uppercase', marginBottom: 8 },
  value: { fontSize: 20, fontWeight: 'bold', color: '#f0f6fc' },
  text: { color: '#f0f6fc' }
});
