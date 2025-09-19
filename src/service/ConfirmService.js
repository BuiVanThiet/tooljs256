import { PowerShell } from 'node-powershell';

const ps = new PowerShell({
    executionPolicy: 'Bypass',
    noProfile: true
});
export async function showConfirm() {
    try {
        const script = `
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show('Do you want to continue?', 'Confirm', 'YesNo', 'Question')
    `;

        const result = await ps.invoke(script);
        console.log('User clicked:', result);
    } catch (err) {
        console.error(err);
    } finally {
        ps.dispose();
    }
}
