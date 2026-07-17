#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Adds an HTTP localhost binding to the IIS site that serves on the LAN IP.
#>
param(
    [string]$LanIp = '10.20.9.59',
    [string]$SiteName,
    [string]$LogFile = "$env:TEMP\add-iis-localhost-binding.log"
)

$ErrorActionPreference = 'Stop'
$appcmd = Join-Path $env:windir 'system32\inetsrv\appcmd.exe'

function Write-Log([string]$Message) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $Message"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

function Test-LanSiteBinding {
    param(
        [string]$BindingInformation,
        [string]$LanIp
    )

    if ([string]::IsNullOrWhiteSpace($BindingInformation)) {
        return $false
    }

    return (
        $BindingInformation -like "${LanIp}:*" -or
        $BindingInformation -like "*:${LanIp}:*" -or
        $BindingInformation -like "*:${LanIp}" -or
        $BindingInformation -like "*:80:${LanIp}"
    )
}

function Convert-BindingsAttributeToList {
    param([string]$BindingsAttribute)

    if ([string]::IsNullOrWhiteSpace($BindingsAttribute)) {
        return @()
    }

    return @(
        $BindingsAttribute -split '\s+' | ForEach-Object {
            if ($_ -match '^(?<protocol>[^/]+)/(?<info>.+)$') {
                [PSCustomObject]@{
                    Protocol = $Matches.protocol
                    BindingInformation = $Matches.info
                }
            }
        } | Where-Object { $_ }
    )
}

function Get-IisSiteRecords {
    $sitesRaw = & $appcmd list sites /xml
    if (-not $sitesRaw) {
        return @()
    }

    [xml]$sitesXml = ($sitesRaw -join "`n")
    if (-not $sitesXml.appcmd.SITE) {
        return @()
    }

    $records = @()
    foreach ($site in @($sitesXml.appcmd.SITE)) {
        $name = $site.'SITE.NAME'
        if (-not $name -and $site.site) {
            $name = $site.site.name
        }
        if (-not $name) {
            continue
        }

        $bindings = @()
        if ($site.bindings) {
            $bindings = Convert-BindingsAttributeToList -BindingsAttribute $site.bindings
        }
        elseif ($site.site.bindings.binding) {
            $bindings = @($site.site.bindings.binding | ForEach-Object {
                [PSCustomObject]@{
                    Protocol = $_.protocol
                    BindingInformation = $_.bindingInformation
                }
            })
        }

        $records += [PSCustomObject]@{
            Name = [string]$name
            Bindings = $bindings
        }
    }

    return $records
}

function Get-IisSiteRecordsFromText {
    $names = @(& $appcmd list sites /text:name)
    $records = @()

    foreach ($name in $names) {
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        $bindingLines = @(& $appcmd list site "$name" /text:bindings)
        $bindings = @(
            foreach ($line in $bindingLines) {
                if ($line -match '^(?<protocol>[^/]+)/(?<info>.+)$') {
                    [PSCustomObject]@{
                        Protocol = $Matches.protocol
                        BindingInformation = $Matches.info
                    }
                }
            }
        )

        $records += [PSCustomObject]@{
            Name = $name.Trim()
            Bindings = $bindings
        }
    }

    return $records
}

try {
    if (-not (Test-Path $appcmd)) {
        throw "IIS appcmd not found: $appcmd"
    }

    Set-Content -Path $LogFile -Value "Starting IIS localhost binding update"

    $targetSiteName = $SiteName
    $existingBindings = @()

    if (-not $targetSiteName) {
        $records = Get-IisSiteRecords
        if ($records.Count -eq 0) {
            Write-Log 'Attribute XML lookup returned no sites; trying text output'
            $records = Get-IisSiteRecordsFromText
        }

        Write-Log "Found $($records.Count) IIS site(s)"

        $targetRecord = $null
        foreach ($record in $records) {
            $bindingText = ($record.Bindings | ForEach-Object { "$($_.Protocol)/$($_.BindingInformation)" }) -join '; '
            Write-Log "Site '$($record.Name)': $bindingText"

            foreach ($binding in $record.Bindings) {
                if (Test-LanSiteBinding -BindingInformation $binding.BindingInformation -LanIp $LanIp) {
                    $targetRecord = $record
                    break
                }
            }
            if ($targetRecord) { break }
        }

        if (-not $targetRecord) {
            foreach ($record in $records) {
                foreach ($binding in $record.Bindings) {
                    if ($binding.Protocol -match '^https?$' -and $binding.BindingInformation -match ':80:') {
                        $targetRecord = $record
                        break
                    }
                }
                if ($targetRecord) { break }
            }
        }

        if ($targetRecord) {
            $targetSiteName = $targetRecord.Name
            $existingBindings = @($targetRecord.Bindings | ForEach-Object { $_.BindingInformation })
        }
    }

    if (-not $targetSiteName) {
        throw "No IIS site with an HTTP binding was found. Re-run with -SiteName 'YourSiteName'."
    }

    Write-Log "Target site: $targetSiteName"

    if ($existingBindings.Count -eq 0) {
        $bindingLines = @(& $appcmd list site "$targetSiteName" /text:bindings)
        foreach ($line in $bindingLines) {
            if ($line -match '^[^/]+/(.+)$') {
                $existingBindings += $Matches[1]
            }
        }
    }

    Write-Log "Existing bindings: $($existingBindings -join '; ')"

    if ($existingBindings -contains '*:80:localhost') {
        Write-Log 'localhost binding already exists. No changes made.'
        exit 0
    }

    & $appcmd set site "$targetSiteName" /+bindings.[protocol='http',bindingInformation='*:80:localhost']
    if ($LASTEXITCODE -ne 0) {
        throw "appcmd failed with exit code $LASTEXITCODE"
    }

    Write-Log 'Added binding: *:80:localhost'

    $verify = @(& $appcmd list site "$targetSiteName" /text:bindings)
    Write-Log "Updated bindings: $($verify -join '; ')"

    $status = curl.exe -s -o NUL -w "%{http_code}" --connect-timeout 5 http://localhost/
    Write-Log "Verification http://localhost/ => HTTP $status"

    if ($status -notin @('200', '301', '302', '401', '403')) {
        Write-Log "WARNING: unexpected status $status (expected redirect or auth challenge, not 404)"
        exit 2
    }

    Write-Log 'SUCCESS'
    exit 0
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}
