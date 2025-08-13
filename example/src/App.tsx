// App.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import CodePush, {
  SyncStatus,
  InstallMode,
} from '@logicwind/react-native-code-push';

function App() {
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = React.useState<number>(0);

  const handleSync = () => {
    CodePush.sync(
      {
        installMode: InstallMode.ON_NEXT_RESTART,
        mandatoryInstallMode: InstallMode.IMMEDIATE,
        updateDialog: {
          title: 'Update Available',
          optionalUpdateMessage:
            'A new version is available. Would you like to install it?',
          optionalInstallButtonLabel: 'Install',
          optionalIgnoreButtonLabel: 'Later',
        },
      },
      (status) => {
        console.log('Sync status:', status);
        setSyncStatus(status);
      },
      (progress) => {
        console.log('Download progress:', progress);
        const percentage = (progress.receivedBytes / progress.totalBytes) * 100;
        setDownloadProgress(percentage);
      }
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>CodePush Example V1</Text>
      <Text>Status: {syncStatus}</Text>
      <Text>Progress: {downloadProgress.toFixed(1)}%</Text>
      <Button title="Check for Updates" onPress={handleSync} />
    </View>
  );
}

// Export with CodePush decorator
export default CodePush({
  checkFrequency: CodePush.CheckFrequency.ON_APP_START,
  installMode: CodePush.InstallMode.ON_NEXT_RESTART,
})(App);
