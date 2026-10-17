# Gọi Windows Hello. In ra: Verified / Canceled / ... hoặc UNAVAILABLE
param([string]$Reason = "Mon TriNote")
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
  $null = [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]
  $avail = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
  if ($avail -ne 'Available') { Write-Output 'UNAVAILABLE'; exit 0 }
  if ($Reason -eq 'check') { Write-Output 'AVAILABLE'; exit 0 }
  $r = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($Reason)) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
  Write-Output $r
} catch { Write-Output 'UNAVAILABLE' }
