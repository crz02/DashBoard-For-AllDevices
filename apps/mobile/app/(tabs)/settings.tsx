import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, Switch, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerBackgroundFetchAsync, unregisterBackgroundFetchAsync } from '../../services/background';

export default function SettingsScreen() {
  const [config, setConfig] = useState({
    dashboardUrl: '',
    userId: '',
    deviceId: '',
    autoStart: false,
    intervalMin: '5'
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const dashboardUrl = await AsyncStorage.getItem('dashboardUrl') || '';
      const userId = await AsyncStorage.getItem('userId') || '';
      const deviceId = await AsyncStorage.getItem('deviceId') || '';
      const autoStart = await AsyncStorage.getItem('autoStart') === 'true';
      const intervalMin = await AsyncStorage.getItem('intervalMin') || '5';
      
      setConfig({ dashboardUrl, userId, deviceId, autoStart, intervalMin });
    };
    loadConfig();
  }, []);

  const saveConfig = async (key: string, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    await AsyncStorage.setItem(key, String(value));
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Handle background task registration
    if (key === 'autoStart' || key === 'intervalMin') {
      const isEnabled = key === 'autoStart' ? value : config.autoStart;
      const interval = parseInt(key === 'intervalMin' ? String(value) : config.intervalMin) || 5;
      
      if (isEnabled) {
        await registerBackgroundFetchAsync(interval);
      } else {
        await unregisterBackgroundFetchAsync();
      }
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        {saved && <Text style={{ color: '#2ea043' }}>Saved ✓</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Connection</Text>
        
        <Text style={styles.label}>Dashboard URL</Text>
        <TextInput
          style={styles.input}
          value={config.dashboardUrl}
          onChangeText={text => saveConfig('dashboardUrl', text)}
          placeholder="http://192.168.1.50:8080"
          placeholderTextColor="#8b949e"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.helpText}>The public or local IP of your Statuser server.</Text>

        <Text style={[styles.label, { marginTop: 16 }]}>User ID (Optional)</Text>
        <TextInput
          style={styles.input}
          value={config.userId}
          onChangeText={text => saveConfig('userId', text)}
          placeholder="default"
          placeholderTextColor="#8b949e"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Agent Configuration</Text>

        <Text style={styles.label}>Device ID (Override)</Text>
        <TextInput
          style={styles.input}
          value={config.deviceId}
          onChangeText={text => saveConfig('deviceId', text)}
          placeholder="Leave blank for auto-detect"
          placeholderTextColor="#8b949e"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Background Reporting</Text>
          <Switch
            value={config.autoStart}
            onValueChange={val => saveConfig('autoStart', val)}
            trackColor={{ false: '#30363d', true: '#1f6feb' }}
            thumbColor="#fff"
          />
        </View>
        <Text style={styles.helpText}>
          Uses Background Fetch to report every ~5 mins. iOS may aggressively throttle this based on battery and usage.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f0f6fc' },
  card: { backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1, borderRadius: 8, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#f0f6fc', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#f0f6fc', marginBottom: 8 },
  input: { backgroundColor: '#0d1117', borderColor: '#30363d', borderWidth: 1, borderRadius: 6, color: '#f0f6fc', padding: 12, fontSize: 16 },
  helpText: { fontSize: 12, color: '#8b949e', marginTop: 6 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }
});
