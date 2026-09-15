import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DevicesScreen() {
  const [devices, setDevices] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDevices = async () => {
    try {
      const url = await AsyncStorage.getItem('dashboardUrl');
      const userId = await AsyncStorage.getItem('userId');
      
      if (!url) {
        setError('Dashboard URL not configured');
        setDevices([]);
        return;
      }

      const fetchUrl = `${url.replace(/\/$/, '')}/api/devices${userId ? `?user_id=${userId}` : ''}`;
      const res = await fetch(fetchUrl);
      
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setError('');
      } else {
        setError('Failed to fetch devices');
      }
    } catch (e: any) {
      setError(e.message || 'Connection error');
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadDevices();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Devices</Text>

      {error ? (
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#f85149' }]}>
          <Text style={{ color: '#f85149' }}>{error}</Text>
        </View>
      ) : null}

      {!error && devices.length === 0 && !refreshing && (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={[styles.title, { fontSize: 18, marginBottom: 8 }]}>No devices found</Text>
          <Text style={{ color: '#8b949e', textAlign: 'center' }}>
            Make sure your Dashboard URL and User ID are correct in Settings.
          </Text>
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f0f6fc" />}
        renderItem={({ item }) => (
          <View style={styles.deviceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.devicePlatform}>{item.platform} • {item.model}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[
                styles.batteryText, 
                { color: item.battery_level < 20 && !item.is_charging ? '#f85149' : '#2ea043' }
              ]}>
                {item.battery_level}%
              </Text>
              <Text style={styles.devicePlatform}>
                {item.is_charging ? '⚡ Charging' : item.power_source}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f0f6fc', marginBottom: 20 },
  card: { backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1, borderRadius: 8, padding: 20, marginBottom: 16 },
  deviceCard: { backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#f0f6fc' },
  devicePlatform: { fontSize: 12, color: '#8b949e', marginTop: 4 },
  batteryText: { fontSize: 20, fontWeight: 'bold' }
});
